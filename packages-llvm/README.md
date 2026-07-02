# Ohnrscript LLVM IR Standard Library

**The first standard library compiled from JavaScript syntax to native machine code via LLVM IR — with zero JavaScript runtime, zero garbage collector, and zero bundled engine.**

---

## What This Is

`packages-llvm` is the native tier of the Ohnrscript standard library. Every package here is compiled from Ohnrscript's JavaScript class syntax directly to ARM64/x86-64 native binaries using the Ohnrscript LLVM IR backend.

This is distinct from the standard `packages/` directory:

| | `packages/` | `packages-llvm/` |
|---|---|---|
| Runtime | Node.js V8 | None — bare native binary |
| Compilation | Babel AOT → JS | Ohnrscript LLVM generator → clang |
| GC | Eliminated (zero-alloc) | Structurally impossible — no runtime |
| Portability | Any Node.js environment | Any ARM64 or x86-64 target |
| Use case | Web servers, APIs, Node.js apps | Systems programming, OS-adjacent, embedded |

---

## Packages

### [`ohn-vector-native`](./ohn-vector-native/) — PROVED ✅
Float32 vector operations. Benchmarked end-to-end. Checksum verified.

| Operation | V8 Turbofan | LLVM Native | Speedup |
|---|---|---|---|
| `dotProduct` | 0.983 ms | 0.111 ms | **8.84x** |
| `l2NormSquared` | 0.739 ms | 0.063 ms | **11.73x** |
| `mapVectorCopy` | 0.668 ms | 0.087 ms | **7.67x** |
| **Average** | | | **9.42x** |

`l2NormSquared` approaches the theoretical 4-wide ARM NEON SIMD ceiling.

---

### [`ohn-fnv1a-native`](./ohn-fnv1a-native/) — Architecture-Proved ✅
FNV-1a hash and zero-allocation byte comparison. The same algorithm powering Ohnrscript's DOD Arena Symbol Table (self-hosted compiler). All generator constructs supported. End-to-end benchmark pending.

---

### [`ohn-sort-native`](./ohn-sort-native/) — Architecture-Proved ✅
Bubble sort, insertion sort, linear search, binary search. Pure integer operations over typed array pointers. No `break` statements — loop termination uses condition variables and `return`, both fully supported by the LLVM generator. End-to-end benchmark pending.

---

## The Pipeline

```
source.ohn
  │
  ▼ Ohnrscript LLVM IR Generator (generator-llvm.ohn)
  │
source.ll  (LLVM IR text — verified with llvm-as)
  │
  ▼ clang -O3 -march=native
  │   + ohnrscript-runtime.c (ohn_alloc_f32, ohn_free)
  │
native binary (ARM64 or x86-64)
  │
  ▼ Run / benchmark / checksum verify
```

No JavaScript engine. No garbage collector. No runtime. The binary starts and executes immediately at full native speed.

---

## Prior Art

| Project | What it does | What it is NOT |
|---|---|---|
| Bun `--compile` | Bundles JavaScriptCore + source into an exe | Native compilation — JS still runs in JSC |
| AssemblyScript | TypeScript → WebAssembly | Native — WASM requires a VM |
| Porffor | Experimental JS → native research | Production-ready or self-hosting |
| esbuild, SWC | Go/Rust programs that *process* JS | JS achieving native speeds |
| **Ohnrscript LLVM** | JS syntax → LLVM IR → bare ARM64/x86-64 | Has any prior project done this |

---

## Reproducibility

Requirements: Node.js ≥ 18, LLVM/clang ≥ 15, Apple Silicon (ARM64) or x86-64 Linux.

```bash
# From the Ohnrscript repo root:
node benchmarks/llvm-vs-js-bench.js
```

---

## Historical Context

`packages-llvm` establishes that Ohnrscript is not a performance library within a JavaScript runtime — it is a **language with two compilation targets**:

1. **V8 JavaScript backend** — zero-allocation, GC-free, for Node.js deployment
2. **LLVM IR native backend** — no runtime, no GC, for systems-level and OS-adjacent deployment

Both targets compile from the same `.ohn` source file written in standard JavaScript class syntax.
