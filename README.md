# Ohnrscript

**Ohnrscript** (`.ohn`) is a domain-specific JavaScript dialect built for high-performance systems programming on V8. It introduces a powerful set of compile-time decorators designed to solve massive CPU and Garbage Collection (GC) bottlenecks in enterprise machine learning and audio provenance pipelines.

By transpiling Ahead-Of-Time (AOT), Ohnrscript enables you to write clean, high-level class definitions that compile down into brutal, zero-allocation memory abstractions and exact byte-shifts.

## Core Features

### ⚡ `@cbor` AOT Serialization
Standard serialization libraries (`JSON.stringify` or `cbor.encode`) rely on slow runtime reflection and dynamic memory allocation. Ohnrscript's `@cbor` decorator eliminates this entirely.
- Pre-calculates exact buffer sizes at compile time.
- Hardcodes byte-shifting logic directly into a generated `toCBOR()` method.
- **Result:** Serializes payloads **16x faster** than the standard Node.js `cbor` library.

### 🧠 `@binaryLayout` Zero-Allocation Memory
Parsing massive streaming network packets or machine learning embeddings normally requires copying `ArrayBuffer` slices, generating huge GC pauses.
- `@binaryLayout` wraps massive buffers in memory-safe getters.
- Extracts arrays and integers directly without allocating new JavaScript objects.
- **Result:** Saves hundreds of megabytes in high-throughput streaming applications by bypassing V8 Garbage Collection almost completely.

## Benchmarks

Ohnrscript's AOT transpiler absolutely crushes runtime libraries. In a benchmark of 100,000 serializations with dynamic length arrays and strings:
- **Standard CBOR Library:** 585.58 ms
- **Ohnrscript AOT CBOR:** 35.49 ms
- **Speedup:** 16.50x faster!

*(You can run the benchmarks yourself in the `benchmarks/` directory).*

## Examples
Check out the `examples/` directory to see `.ohn` dialect files alongside their compiled JavaScript outputs to understand how the memory math is generated.

## Getting Started

1. Clone the repository
2. Run `npm install`
3. Try transpiling an example:
```bash
./bin/ohnc.js examples/test4.ohn
```

## Contributing
We welcome ecosystem contributions! Our goal is to build out a full ecosystem of lightweight, high-performance mini-apps, parsing libraries, and data structures built entirely in Ohnrscript.
