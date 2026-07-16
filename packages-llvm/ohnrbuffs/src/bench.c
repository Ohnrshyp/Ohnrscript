#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <sys/time.h>

// Extern declaration for the Ohnrscript function
// It takes a pointer to the buffer (i64 in Ohnrscript LLVM boundary) and iteration count.
extern int32_t benchmarkDecode(int64_t buffer, int64_t iterations);

int main() {
    // Allocate a buffer representing our Ohnrbuffs payload
    // 20 integers + 20 strings (each string needs a length word + string data words).
    // For this mock, we'll assume strings are 8 characters (2 words) each.
    // Total words per string = 1 (len) + 2 (data) = 3 words.
    // Total buffer words = 20 (ints) + 20 * 3 (strings) = 80 words.
    int32_t* buffer = (int32_t*)malloc(100 * sizeof(int32_t));
    
    // Fill buffer with dummy data
    int offset = 0;
    // 20 ints
    for(int i = 0; i < 20; i++) {
        buffer[offset++] = 42; // dummy int value
    }
    // 20 strings
    for(int i = 0; i < 20; i++) {
        buffer[offset++] = 2; // string length in words (8 chars)
        buffer[offset++] = 0x41414141; // "AAAA"
        buffer[offset++] = 0x41414141; // "AAAA"
    }
    
    int64_t iterations = 1000000;
    
    // Warmup
    int32_t warmup_chk = benchmarkDecode((int64_t)buffer, 10000);
    
    struct timeval start, end;
    gettimeofday(&start, NULL);
    
    // The actual race
    int32_t final_checksum = benchmarkDecode((int64_t)buffer, iterations);
    
    gettimeofday(&end, NULL);
    
    long mtime, seconds, useconds;    
    seconds  = end.tv_sec  - start.tv_sec;
    useconds = end.tv_usec - start.tv_usec;
    mtime = ((seconds) * 1000 + useconds/1000.0) + 0.5;
    
    printf("Ohnrbuffs Native (LLVM) Decoder Benchmark\n");
    printf("Iterations: %lld\n", iterations);
    printf("Total Execution Time: %ld ms\n", mtime);
    printf("Checksum (prevent DCE): %d\n", final_checksum);
    
    free(buffer);
    return 0;
}
