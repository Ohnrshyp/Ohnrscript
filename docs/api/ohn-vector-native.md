# ohn-vector-native

**LLVM-compiled vector operations.** Dot product, L2 norm, and memory copy — compiled from Ohnrscript to native ARM64/x86-64 machine code via LLVM IR. LLVM `-O3` auto-vectorizes these loops using ARM NEON SIMD (4 floats per cycle).

**Target:** LLVM (Native)

---

## Pipeline

```
.ohn → Ohnrscript LLVM generator → .ll → clang -O3 -march=native → ARM64 native binary
```

---

## Benchmark Results

Measured on Apple M1, Node.js v22.16.0, LLVM 22.1.8. Input: 1,048,576 Int32 elements.

| Function | V8 (ms) | Native (ms) | Speedup |
|---|---|---|---|
| `dotProduct` | 0.983 | 0.111 | **8.84×** |
| `l2NormSquared` | 0.739 | 0.063 | **11.73×** |
| `mapVectorCopy` | 0.668 | 0.087 | **7.67×** |
| **Average** | | | **9.42×** |

Checksum verified: 33159168 (identical between JS and native execution).

---

## Functions

### `dotProduct(a, b, n)`

Computes the dot product (sum of `a[i] * b[i]`) for `i` in `[0, n)`.

- **Parameters:**
  - `a` (i64 address) — Pointer to first Int32Array
  - `b` (i64 address) — Pointer to second Int32Array
  - `n` (i32) — Number of elements
- **Returns:** `i32` — The dot product sum

LLVM auto-vectorizes as: `fmla v0.4s, v1.4s, v2.4s`

---

### `l2NormSquared(a, n)`

Computes the squared L2 norm (sum of `a[i]²`) for `i` in `[0, n)`.

- **Parameters:**
  - `a` (i64 address) — Pointer to Int32Array
  - `n` (i32) — Number of elements
- **Returns:** `i32` — The squared L2 norm

LLVM auto-vectorizes as: `fmla v0.4s, v1.4s, v1.4s`
Approaches the theoretical 4-wide SIMD ceiling at 11.73× speedup.

---

### `mapVectorCopy(src, dst, n)`

Copies `n` elements from `src` to `dst`.

- **Parameters:**
  - `src` (i64 address) — Source Int32Array pointer
  - `dst` (i64 address) — Destination Int32Array pointer
  - `n` (i32) — Number of elements to copy
- **Returns:** `i32` — The value of `n`

LLVM auto-vectorizes as: `ldr q0, [x0]; str q0, [x1]`

---

## Constraints

- All arithmetic uses `| 0` (SMI-safe)
- Parameters are i64 addresses on the host side — the LLVM generator emits `inttoptr i64 %param to ptr`
- No unsupported constructs (`grep '; UNSUPPORTED'` on emitted `.ll` returns zero results)
