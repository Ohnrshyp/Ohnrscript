// ohnrscript-runtime.c
// Thin C runtime shim for Ohnrscript LLVM IR compiled binaries.
// Provides memory allocation primitives used by the LLVM backend.
//
// Compile once:
//   cc -O3 -c compiler/src/shim/ohnrscript-runtime.c -o ohnrscript-runtime.o
//
// Link with compiled module:
//   clang -O3 -march=native output.ll ohnrscript-runtime.o -o binary -lm

#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <stdio.h>

// The WebAssembly-style 64MB linear heap for Ohnrscript
uint8_t* ohn_heap_base = NULL;
uint32_t ohn_heap_offset = 0;
#define OHN_HEAP_MAX_SIZE (64 * 1024 * 1024)

// Helper macro for C-shims to mathematically recover the 64-bit pointer
// from Ohnrscript's truncated 32-bit FFI boundary.
void* ohn_resolve_ptr(uint32_t key) {
    if (!ohn_heap_base) return NULL;
    // The key is now a direct byte offset into the linear memory sandbox
    return (void*)(ohn_heap_base + key);
}

// Hardened bounds-checked pointer resolver to prevent memory corruption
// across the FFI boundary. Throws a fatal error and exits on out-of-bounds access.
void* ohn_resolve_ptr_safe(uint32_t base_offset, uint32_t byte_length) {
    if (!ohn_heap_base) return NULL;

    // 1. Prevent integer wrap-around (overflow)
    if (base_offset + byte_length < base_offset) {
        fprintf(stderr, "FATAL: FFI Memory offset overflow! base=%u, len=%u\n", base_offset, byte_length);
        exit(1);
    }
    
    // 2. Check against the 64MB heap boundary
    if (base_offset + byte_length > OHN_HEAP_MAX_SIZE) {
        fprintf(stderr, "FATAL: FFI Out of bounds memory access! base=%u, len=%u\n", base_offset, byte_length);
        exit(1); 
    }
    
    return (void*)(ohn_heap_base + base_offset);
}

// ohn_alloc_f32: allocate N float elements with 64-byte cache-line alignment.
// The 64-byte alignment ensures AVX-512 auto-vectorization can use aligned loads.
uint32_t ohn_alloc_f32(int32_t count) {
    if (count <= 0) return 0;
    
    // Lazy initialize the 64MB heap on first allocation
    if (!ohn_heap_base) {
        // Allocate raw memory + 64 bytes for manual alignment
        void* raw_mem = malloc(OHN_HEAP_MAX_SIZE + 64);
        if (!raw_mem) return 0;
        
        // Manually align to 64-byte boundary (OS agnostic)
        uintptr_t raw_addr = (uintptr_t)raw_mem;
        uintptr_t aligned_addr = (raw_addr + 63) & ~(uintptr_t)63;
        ohn_heap_base = (uint8_t*)aligned_addr;
        
        memset(ohn_heap_base, 0, OHN_HEAP_MAX_SIZE);
    }

    size_t size = (size_t)count * sizeof(float);
    // Round up to nearest 64 bytes for AVX-512 alignment
    size_t aligned_size = (size + 63) & ~(size_t)63;
    
    if (ohn_heap_offset + aligned_size > OHN_HEAP_MAX_SIZE) {
        return 0; // Out of memory!
    }

    uint32_t key = ohn_heap_offset;
    ohn_heap_offset += aligned_size;
    
    return key;
}

// ohn_free: bump allocator cannot easily free individual blocks.
// In a true WASM heap, memory is garbage collected or arena-reset.
void ohn_free(uint32_t ptr) {
    // No-op for the bump allocator.
}

// ohn_alloc_i32: allocate N int32 elements with 64-byte alignment
uint32_t ohn_alloc_i32(int32_t count) {
    if (count <= 0) return 0;
    
    if (!ohn_heap_base) {
        void* raw_mem = malloc(OHN_HEAP_MAX_SIZE + 64);
        if (!raw_mem) return 0;
        
        uintptr_t raw_addr = (uintptr_t)raw_mem;
        uintptr_t aligned_addr = (raw_addr + 63) & ~(uintptr_t)63;
        ohn_heap_base = (uint8_t*)aligned_addr;
        
        memset(ohn_heap_base, 0, OHN_HEAP_MAX_SIZE);
    }

    size_t size = (size_t)count * sizeof(int32_t);
    size_t aligned_size = (size + 63) & ~(size_t)63;
    
    if (ohn_heap_offset + aligned_size > OHN_HEAP_MAX_SIZE) {
        return 0;
    }

    uint32_t key = ohn_heap_offset;
    ohn_heap_offset += aligned_size;
    
    return key;
}

// ohn_memcpy_f32: block copy N floats from src to dst.
// Compiler can auto-vectorize this with SIMD when N is large.
void ohn_memcpy_f32(float* dst, const float* src, int32_t count) {
    memcpy(dst, src, (size_t)count * sizeof(float));
}

// ohn_memcpy_i32: block copy N int32s from src to dst.
void ohn_memcpy_i32(int32_t* dst, const int32_t* src, int32_t count) {
    memcpy(dst, src, (size_t)count * sizeof(int32_t));
}
