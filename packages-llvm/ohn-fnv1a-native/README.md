# ohn-fnv1a-native

**Ohnrscript LLVM IR Standard Library — FNV-1a Hash (Non-Cryptographic)**

## Status: Architecture-Proved ✅

All constructs are within the supported LLVM generator subset. Zero unsupported nodes. Pending end-to-end benchmark run.

## What This Is

`ohn-fnv1a-native` compiles the FNV-1a hash algorithm from Ohnrscript JavaScript syntax to native ARM64/x86-64 machine code via LLVM IR. FNV-1a is the hash at the core of Ohnrscript's DOD Arena Symbol Table (used by the self-hosted compiler for zero-allocation identifier deduplication).

## Why FNV-1a Is Significant for LLVM

The V8 version (`arena.ohn`) uses `Math.imul(hash, 16777619)` — this is required to prevent V8's JIT from promoting the multiplication result to a `HeapNumber` object. In LLVM IR, `mul i32` is already 32-bit truncating by specification. Plain `*` with `| 0` produces mathematically identical results with no extra instruction.

This demonstrates a core principle: **Ohnrscript code written for the V8 backend can be trivially adapted for the LLVM backend by removing V8-specific workarounds** — the LLVM type system enforces the constraints that V8 needed special functions for.

## Functions

| Function | Description |
|---|---|
| `fnv1a(source, offset, length)` | Hash bytes in `[offset, offset+length)` |
| `fnv1aRange(source, length)` | Hash from index 0 — convenience wrapper |
| `compareBytes(a, aOff, b, bOff, len)` | Zero-allocation byte comparison, returns 1/0 |

## Files

```
ohn-fnv1a-native/
  src/
    ohn-fnv1a-native.ohn     ← Ohnrscript source (JavaScript syntax)
  dist/
    ohn-fnv1a-native.ll      ← Compiled LLVM IR (generated, do not edit)
    ohn-fnv1a-native         ← Native binary (ARM64 or x86-64)
  README.md
```
