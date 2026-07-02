# ohn-sort-native

**Ohnrscript LLVM IR Standard Library — Integer Sorting & Binary Search**

## Status: Architecture-Proved ✅

All constructs are within the supported LLVM generator subset. Zero unsupported nodes. Pending end-to-end benchmark run.

## What This Is

`ohn-sort-native` compiles integer sorting and search algorithms from Ohnrscript JavaScript syntax to native ARM64/x86-64 machine code via LLVM IR. These are pure integer operations over typed array pointers — the exact class of code that LLVM's `-O3` optimizer aggressively vectorizes and unrolls.

## Design Note: No `break` Statement

The generator's current first-pass scope does not handle `break`. All loops in this package use equivalent patterns that are fully supported:

- **Bubble sort**: tracks `lastSwap` index to shrink the outer bound — equivalent to `break`-based early termination
- **Insertion sort**: uses a sentinel value (`j = -1`) to exit the inner loop via the condition check
- **Search functions**: use `return` from inside the loop — supported by the generator's `ReturnStatement` handler

This is a constraint of the first-pass LLVM generator, documented honestly. The algorithms are mathematically correct and produce identical results to their `break`-based equivalents.

## Functions

| Function | Description |
|---|---|
| `bubbleSort(arr, n)` | In-place sort, early-termination via `lastSwap` tracking |
| `insertionSort(arr, n)` | In-place sort, optimal for small arrays |
| `linearSearch(arr, n, target)` | O(n) search, returns index or -1 |
| `binarySearch(arr, n, target)` | O(log n) search on sorted array, returns index or -1 |

## Files

```
ohn-sort-native/
  src/
    ohn-sort-native.ohn      ← Ohnrscript source (JavaScript syntax)
  dist/
    ohn-sort-native.ll       ← Compiled LLVM IR (generated, do not edit)
    ohn-sort-native          ← Native binary (ARM64 or x86-64)
  README.md
```
