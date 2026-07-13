# ohn-fnv1a-native

**LLVM-compiled FNV-1a hash and byte comparison.** Compiles the FNV-1a hash algorithm and a zero-allocation byte comparison function from Ohnrscript to native machine code via LLVM IR.

**Target:** LLVM (Native)

---

## Pipeline

```
.ohn → Ohnrscript LLVM generator → .ll → clang -O3 -march=native → ARM64/x86-64 native binary
```

---

## Functions

### `fnv1a(source, offset, length)`

Computes the FNV-1a hash of bytes in the range `[offset, offset + length)`.

- **Parameters:**
  - `source` (i64 address) — Pointer to the byte array
  - `offset` (i32) — Starting byte offset
  - `length` (i32) — Number of bytes to hash
- **Returns:** `i32` — The signed 32-bit FNV-1a hash

**Algorithm:**
```
hash = 2166136261 (FNV offset basis)
for each byte:
    hash = hash XOR byte
    hash = hash * 16777619 (FNV prime)
```

In LLVM IR, `mul i32` is inherently 32-bit truncating — no `Math.imul()` needed.

---

### `fnv1aRange(source, length)`

Convenience wrapper — hashes from index 0 to `length`.

- **Parameters:**
  - `source` (i64 address) — Pointer to the byte array
  - `length` (i32) — Number of bytes to hash
- **Returns:** `i32` — The signed 32-bit FNV-1a hash

```ohnrscript
// Equivalent to: fnv1a(source, 0, length)
let hash = fnv1aRange(data, dataLen) | 0;
```

---

### `compareBytes(a, aOffset, b, bOffset, length)`

Zero-allocation byte-by-byte comparison. Returns `1` if all bytes match, `0` if any differ.

- **Parameters:**
  - `a` (i64 address) — Pointer to first byte array
  - `aOffset` (i32) — Starting offset in `a`
  - `b` (i64 address) — Pointer to second byte array
  - `bOffset` (i32) — Starting offset in `b`
  - `length` (i32) — Number of bytes to compare
- **Returns:** `i32` — `1` if equal, `0` if not

```ohnrscript
// Compare 16 bytes starting at offset 0 in both buffers
let match = compareBytes(bufA, 0, bufB, 0, 16) | 0;
if (match === 1) {
    // Buffers are identical in the compared range
}
```

---

## Constraints

- All arithmetic uses `| 0` (SMI-safe)
- Parameters are i64 byte array addresses
- Zero unsupported constructs in the emitted LLVM IR
