# ohn-sort-native

**LLVM-compiled integer sorting and binary search.** Pure integer operations over typed array pointers — the exact class of code that LLVM's `-O3` optimizer aggressively vectorizes and unrolls.

**Target:** LLVM (Native)

**Status:** Architecture-proved ✅ (all constructs within the supported LLVM generator subset, zero unsupported nodes)

---

## Pipeline

```
.ohn → Ohnrscript LLVM generator → .ll → clang -O3 -march=native → ARM64/x86-64 native binary
```

---

## Functions

### `bubbleSort(arr, n)`

In-place bubble sort with early termination via `lastSwap` tracking. Shrinks the comparison window each pass.

- **Parameters:**
  - `arr` (i64 address) — Pointer to Int32Array
  - `n` (i32) — Number of elements
- **Returns:** `i32` — Always returns 0

---

### `insertionSort(arr, n)`

In-place insertion sort. Optimal for small arrays (< ~50 elements) where the overhead of a more complex algorithm isn't justified.

- **Parameters:**
  - `arr` (i64 address) — Pointer to Int32Array
  - `n` (i32) — Number of elements
- **Returns:** `i32` — Always returns 0

---

### `linearSearch(arr, n, target)`

O(n) linear scan. Returns the index of the first match, or `-1` if not found.

- **Parameters:**
  - `arr` (i64 address) — Pointer to Int32Array
  - `n` (i32) — Number of elements
  - `target` (i32) — Value to find
- **Returns:** `i32` — Index of match, or `-1`

---

### `binarySearch(arr, n, target)`

O(log n) binary search on a **sorted** array. Returns the index of the match, or `-1` if not found.

- **Parameters:**
  - `arr` (i64 address) — Pointer to a **sorted** Int32Array
  - `n` (i32) — Number of elements
  - `target` (i32) — Value to find
- **Returns:** `i32` — Index of match, or `-1`

---

## Design Note

The LLVM generator fully supports `break` and `continue`. Earlier versions of this package used equivalent loop patterns (sentinel values, condition variables) as workarounds. These patterns remain in the source as they are mathematically identical and produce optimal LLVM IR.
