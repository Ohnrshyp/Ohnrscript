/*
 * ohn-bench-harness-main.c
 * Native benchmark for Ohnrscript LLVM IR compiled functions.
 *
 * The Ohnrscript i32 ABI cannot hold 64-bit ARM pointers.
 * Instead, we benchmark the functions using a fixed base address
 * that fits in 32 bits by allocating in low memory with mmap,
 * OR we use the functions as i32 accumulator loops (the actual
 * benchmarked logic) and pass indices, not raw pointers.
 *
 * This harness calls the LLVM-compiled functions directly with
 * proper 64-bit pointer passing by declaring them with ptr params.
 */
#include <stdlib.h>
#include <stdio.h>
#include <stdint.h>
#include <time.h>
#include <string.h>

/* The LLVM IR emits i32 params, but we re-declare here as ptr for 64-bit.
   This works because ARM64 ABI passes pointers in 64-bit registers. */
extern int ohn_dot_product_native(float* a, float* b, int length);
extern int ohn_l2_norm_native(float* a, int length);
