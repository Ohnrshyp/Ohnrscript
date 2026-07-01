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

// ohn_alloc_f32: allocate N float elements with 64-byte cache-line alignment.
// The 64-byte alignment ensures AVX-512 auto-vectorization can use aligned loads.
float* ohn_alloc_f32(int32_t count) {
    if (count <= 0) return NULL;
    // aligned_alloc requires size to be multiple of alignment
    size_t size = (size_t)count * sizeof(float);
    // Round up to nearest 64 bytes
    size_t aligned_size = (size + 63) & ~(size_t)63;
    return (float*)aligned_alloc(64, aligned_size);
}

// ohn_free: release an arena allocated by ohn_alloc_f32 or ohn_alloc_i32
void ohn_free(void* ptr) {
    free(ptr);
}

// ohn_alloc_i32: allocate N int32 elements with 64-byte alignment
int32_t* ohn_alloc_i32(int32_t count) {
    if (count <= 0) return NULL;
    size_t size = (size_t)count * sizeof(int32_t);
    size_t aligned_size = (size + 63) & ~(size_t)63;
    return (int32_t*)aligned_alloc(64, aligned_size);
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
