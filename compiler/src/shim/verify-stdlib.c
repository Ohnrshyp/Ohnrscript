#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// Globals defined in the LLVM IR
extern void* pool;
extern uint32_t poolOffset;
extern uint32_t POOL_SIZE;
extern void* outBuffer;
extern void* hexLookup;
extern void* rawBuffer;

// Functions defined in the LLVM IR
extern void __get_module_exports_ohn_uuid();
extern int32_t generateUUIDv4();

// Our fast userspace PRNG (XorShift128+)
uint64_t s[2] = { 0x1234567890abcdef, 0xfedcba0987654321 };
uint64_t xorshift128plus(void) {
    uint64_t s1 = s[0];
    const uint64_t s0 = s[1];
    s[0] = s0;
    s1 ^= s1 << 23;
    s[1] = s1 ^ s0 ^ (s1 >> 18) ^ (s0 >> 5);
    return s[1] + s0;
}

// Mock for require('crypto')
struct CryptoMock {
    void* randomBytes;
};
struct CryptoMock mock_crypto;

void* my_c_random_bytes_wrapper(uint32_t size) {
    // Fill the pool with random data
    uint8_t* p = (uint8_t*)pool;
    for (uint32_t i = 0; i < size; i++) {
        p[i] = xorshift128plus() & 0xFF;
    }
    return pool;
}

void* __get_module_exports_crypto() {
    mock_crypto.randomBytes = &my_c_random_bytes_wrapper;
    return &mock_crypto;
}

int main() {
    setbuf(stdout, NULL);
    printf("[*] Setting up C test harness...\n");

    // Allocate memory slabs (aligned to 64 bytes, size multiple of 64)
    void* p_pool = aligned_alloc(64, 65536);
    void* p_out = aligned_alloc(64, 64);
    void* p_hex = aligned_alloc(64, 256);
    void* p_raw = aligned_alloc(64, 64);

    if (!p_pool || !p_out || !p_hex || !p_raw) {
        printf("[!] Failed to allocate aligned memory\n");
        return 1;
    }

    // Initialize hex lookup table (ASCII)
    const char* hex_chars = "0123456789abcdef";
    uint32_t* h = (uint32_t*)p_hex;
    for (int i = 0; i < 16; i++) {
        h[i] = hex_chars[i]; // Store as i32, matching LLVM IR getelementptr i32
    }

    // Inject our pointers into the IR globals BEFORE init!
    pool = p_pool;
    outBuffer = p_out;
    hexLookup = p_hex;
    rawBuffer = p_raw;
    POOL_SIZE = 65536;

    // Call the module getter to run init_block
    __get_module_exports_ohn_uuid();

    poolOffset = 65536; // Trigger entropy fill on first call

    // Fill entropy manually for the first time
    my_c_random_bytes_wrapper(65536);
    poolOffset = 65536;

    printf("[*] Calling generateUUIDv4() native function...\n");
    
    // Call the function!
    generateUUIDv4();

    // Print result
    uint32_t* out = (uint32_t*)outBuffer;
    printf("[*] UUID Generated: ");
    for (int i = 0; i < 36; i++) {
        printf("%c", (char)out[i]);
    }
    printf("\n");

    // Verify format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    int pass = 1;
    if (out[14] != '4') {
        printf("[FAIL] Version nibble is not 4! (Got %c)\n", out[14]);
        pass = 0;
    }
    char variant = out[19];
    if (variant != '8' && variant != '9' && variant != 'a' && variant != 'b') {
        printf("[FAIL] Variant nibble is not 8, 9, a, or b! (Got %c)\n", variant);
        pass = 0;
    }
    if (out[8] != '-' || out[13] != '-' || out[18] != '-' || out[23] != '-') {
        printf("[FAIL] Hyphens are not in the correct positions!\n");
        pass = 0;
    }

    if (pass) {
        printf("[PASS] ALL ASSERTIONS PASSED\n");
        return 0;
    } else {
        return 1;
    }
}
