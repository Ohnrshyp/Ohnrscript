<div align="center">
  <img src="docs/ohn-logo.png" alt="Ohnrscript Logo" width="128" height="128" />
  <h1>Ohnrscript</h1>
</div>

<p align="center">
  <strong>Web-Native Syntax At Bare Metal Speed</strong>
</p>

<p align="center">
  <a href="https://github.com/ohnrshyp/ohnrscript/actions/workflows/ci.yml">
    <img src="https://github.com/ohnrshyp/ohnrscript/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://ohnrshyp.com">
    <img src="https://img.shields.io/badge/docs-ohnrshyp.com-blue.svg?style=flat-square" alt="Documentation" />
  </a>
  <img src="https://img.shields.io/badge/version-v0.8.3-blue.svg?style=flat-square" alt="Version 0.8.3" />
  <img src="https://img.shields.io/badge/language-Javascript%20%7C%20LLVM-orange.svg?style=flat-square" alt="Language JS/LLVM" />
  <img src="https://img.shields.io/badge/status-Stable-success.svg?style=flat-square" alt="Status Stable" />
</p>

**Ohnrscript** (`.ohn`) is a Turing-complete dual compiling language, Ahead-Of-Time (AOT) compiler, and operating system stack built entirely from scratch. (`.ohn`) files can compile to either LLVM IR or highly-optimized JavaScript Syntax for the *V8 Engine*.

The *Ohn Kernel* logic, which borrows from JavaScript syntax, compiles Ahead-of-Time via LLVM IR to bare-metal x86-64 ELF, executing in Ring 0 with **no** JavaScript runtime beneath it.

According to our benchmarks, Ohnrscript allows enterprise hyperscalers, AI data centers, and high-frequency embedded systems to process massive network payloads and execute ML inference at bare-metal speeds without abandoning web-native syntax.

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ohnrshyp/ohnrscript.git
cd ohnrscript

# Install dependencies
npm install

# Run the V8 package benchmarks (uuid, cbor, ws, cookie, zod)
./run-cleanroom-benchmarks.sh

# Boot the kernel (Docker required — no other dependencies needed)
docker build -t ohn-kernel .
docker run -it --rm -p 8080:8080 ohn-kernel

# In another terminal:
curl http://localhost:8080
# → OK
```

*See `packages-llvm/ohn-kernel/README.md` for native build instructions without Docker.*
*Full benchmark report: `benchmarks/BENCHMARK_RESULTS.md`*

### Editor Support
Because Ohnrscript enforces a strict subset of JavaScript syntax and introduces custom primitives, we highly recommend installing official language support for syntax highlighting, IntelliSense, and LSP diagnostics.

All editor tooling lives in the dedicated **[Ohnrscript Language Support](https://github.com/Ohnrshyp/Ohnrscript-Language-Support)** repository (v0.3.0):

| Editor | How to Install |
|--------|---------------|
| **VS Code** | Download the `.vsix` from the [latest release](https://github.com/Ohnrshyp/Ohnrscript-Language-Support/releases) and install via `Extensions: Install from VSIX...` |
| **Zed** | Clone the repo, then `Cmd+Shift+P` → `zed: install dev extension` → select `editors/zed/` |
| **Neovim / Helix / Emacs** | Clone the repo, run `cd lsp && npm install && npm link`, then configure your editor's LSP client |

```sh
git clone https://github.com/Ohnrshyp/Ohnrscript-Language-Support.git
cd Ohnrscript-Language-Support/lsp && npm install && npm link
```

---

## The Shift

Modern compute relies heavily on dynamic runtimes (Node.js/V8) or heavy, generalized operating systems (Linux/Windows). When building for extreme throughput—such as parsing massive network streams or executing ML inference—these layers introduce catastrophic overhead:
1. **Garbage Collection (GC) Pauses:** Dynamic memory allocation forces the runtime to pause execution to reclaim memory.
2. **Context Switching Latency:** Transitioning from user-space to kernel-space takes thousands of CPU cycles.
3. **VM Overhead:** Executing JavaScript traditionally requires booting a massive JIT engine.

**Ohnrscript solves this by eliminating the runtime.** 

Ohnrscript enforces static typing through inference, manual memory management via direct physical address mapping, and compile-time buffer allocations. The Ohnrscript compiler (`generator-llvm.ohn`) reads standard JS syntax and emits **native LLVM Intermediate Representation (IR)**. 

The result is a binary that executes on bare metal with zero dependencies, unlocking first-principles engineering solutions previously impossible in web environments:

- **POSIX-less Block Storage**: The `db.ohn` package bypasses ext4/NTFS entirely, utilizing **Logical Block Addressing (LBA)** for zero-copy, direct-to-disk operations.
- **Deterministic Rendering**: The `three.ohn` engine bypasses hardware Floating-Point Units (FPUs), utilizing a custom bit-packed integer math engine for perfect state determinism across heterogeneous hardware.

---

## Compiler Pipeline

Ohnrscript is self-hosted and designed around strict **Data-Oriented Design (DOD)** principles.

### 1. The DOD Memory Arena (`compiler/src/core/arena.ohn`)
This is where Ohnrscript fundamentally departs from standard JS runtime behavior.
- Bypasses V8 heap allocation by pre-allocating (16MB) contiguous `ArrayBuffers`.
- Maps memory strictly through `Int32Array` and `Uint8Array` views.
- Achieves zero-allocation scope tearing by utilizing `u32.fill(0)` instead of relying on Garbage Collection (GC) sweeps.

### 2. The Zero-Allocation Parser (`compiler/src/frontend/parser.ohn`)
Instead of instantiating thousands of JavaScript AST Node objects, the parser writes directly into the `ScopeArena`.
- Uses a custom **SMI-safe FNV-1a hashing** algorithm for string interning.
- Parses massive files linearly without triggering a single GC pause.

### 3. The LLVM IR Generator (`compiler/src/codegen/generator-llvm.ohn`)
Instead of transpiling to C or relying on JIT engines, the primary backend directly maps the AST arenas to LLVM IR registers. 
- `const x = 5` maps directly to an `i32` LLVM allocation.
- `Float32Array` accesses map directly to raw physical pointer offsets via `getelementptr`.
- Loop termination variables and condition branching are perfectly preserved in the generated `.ll` files.

### 4. The V8 Generator (`compiler/src/codegen/generator.ohn`)
The secondary backend that allows Ohnrscript to compile to itself for execution inside standard JS engines.
- Walks the packed AST arenas and emits valid JS source code.
- Enforces a strict "no string concatenation" rule in the hot path.
- Utilizes pre-allocated `Uint8Array` buffers for all static keywords (e.g., `if`, `while`) to achieve zero-copy code emission.

### 5. The Zero-Copy Emitter (`compiler/src/codegen/emitter.ohn`)
The final stage of the pipeline guarantees deterministic, low-memory disk I/O.
- Bypasses V8 String allocation entirely by grabbing a 1MB `allocUnsafe` memory slab outside the V8 heap.
- Streams raw UTF-8 bytes directly to the file descriptor via a custom ring-buffer.
- Allows the compiler to generate massive binaries without increasing memory footprint.

---

## A Mature Ecosystem (`packages-llvm/` & `packages`)

Because Ohnrscript is a dual-compiling language, its ecosystem is divided to support both execution targets. The `packages-llvm/` directory provides the bare-metal system architecture for the LLVM target, while the `packages/` directory provides zero-allocation web APIs for the V8 target. Together, they form what we believe is a new **sovereign computing stack**:

### The LLVM Stack (`packages-llvm/`)
These packages utilize direct LLVM bindings to build system-level architecture from scratch.

#### `ohn-kernel`
A 64KB HTTP-serving unikernel written entirely in Ohnrscript syntax.
- Boots via Multiboot, initializes its own VirtIO-net driver, implements TCP, and serves HTTP.
- Uses a FOH/BOH (Front of House / Back of House) polling architecture — no interrupts in the hot path.
- Links ecosystem packages (`http.ohn`, `tcp.ohn`, `router.ohn`, `db.ohn`) at compile time.
- Deployable via Docker in one command or as a Firecracker micro-VM image.

#### `node.ohn`
A natively-compiled web server and Node.js runtime replacement.
- Utilizes `kqueue/epoll` event loops and `SO_REUSEPORT` fork logic.
- Handles massive concurrent socket connections by completely bypassing V8 and libuv.
- Employs zero-dynamic-allocation ring buffers for network I/O.

#### `three.ohn`
A custom mathematics and 3D graphics engine implemented entirely via bit-packed integer arithmetic. 
- Bypasses hardware Floating-Point Units (FPUs).
- Uses software-only math execution to guarantee deterministic calculations across heterogeneous data center hardware.
- Allows massive neural network state and simulations to run exactly the same way on every CPU architecture.

#### `db.ohn`
A bare-metal Block Storage interface and disk IO manager. 
- Writes directly to physical disk images (`disk.img`) using raw block offsets.
- Bypasses standard OS file systems (ext4/NTFS) for zero-copy, direct-to-disk read/writes.

#### `tls.ohn`
Native cryptography and secure communications.
- Integrates deterministic, pre-allocated security primitives using `mbedtls` architecture.
- Handles asymmetric key exchange directly in kernel space.

#### `ohn-vector-native`
SIMD-optimized Float32 vector operations for machine learning workloads.
- Benchmarked at **9.42x faster** than V8 Turbofan for `dotProduct` and `l2NormSquared`.
- Approaches the theoretical maximum 4-wide ARM NEON SIMD ceiling using Ohnrscript LLVM code generation.

#### `ohnrbuffs`
A zero-allocation serialization format (comparable to FlatBuffers or Cap'n Proto).
- Encodes massive streaming payloads in micro-seconds by calculating exact buffer sizes at compile time.
- Compiles byte-shifting logic directly into the generated binary, avoiding all dynamic reflection.

#### `workers.ohn`
Native multi-threading and concurrency primitives.
- Implements lock-free MPSC (Multi-Producer, Single-Consumer) queues.
- Utilizes raw `eventfd` for zero-latency thread wakeups.

### The Web-Native Library (`packages/`)
While `packages-llvm` handles the bare-metal system architecture, the `packages` directory provides ergonomic, web-native APIs built using strict zero-allocation Data-Oriented Design (DOD) principles.

#### `ohn-ws`
A massive-throughput WebSocket implementation.
- Handles continuous socket framing and binary payloads.
- Maintains connection state with zero dynamic object allocation overhead.

#### `ohn-zod`
Schema validation and static parsing.
- Validates network payloads without instantiating temporary validation objects.
- Designed to run at bare-metal speeds in high-frequency data pipelines.

#### `ohn-cbor`, `ohn-cookie`, & `ohn-uuid`
Data serialization and network identifiers.
- Provides strict, typed interfaces for processing network payloads.
- Ensures all memory mappings are fully deterministic during decoding.

---

## Memory Management: The `i32` Architecture

JavaScript syntax inherently abstracts away memory management, relying on Garbage Collection (GC) and dynamic heaps. Because Ohnrscript eliminates the runtime, it required a first-principles redesign of memory and type semantics.

### The Single-Type Foundation
Under the hood, Ohnrscript enforces a radically strict memory model: **the entire language is built on 32-bit integers (`i32`)**. 
- There are no objects, no strings, and no dynamic references. 
- Variables map directly to LLVM `i32` virtual registers.
- Pointers and memory addresses are simply raw integers representing offsets in pre-allocated static arenas.

### The 26+6 Bit-Packed Math Engine
Because Ohnrscript enforces a strict `i32` architecture, it lacks native hardware floating-point variables. To execute 3D rendering (`three.ohn`) and neural network operations without floats, we engineered a completely custom **26+6 bit-packed fixed-point math engine**.

- **The Architecture:** Every 32-bit integer is bit-shifted to hold a 26-bit value (the significand) and a 6-bit scale (the exponent). 
- **FPU-Bypass:** By executing fractional math purely via integer bit-shifting, Ohnrscript completely bypasses the CPU's hardware Floating-Point Unit (FPU).
- **Absolute Determinism:** Hardware FPUs introduce micro-rounding discrepancies between different CPU architectures (e.g., ARM vs. x86). By forcing all math through our software integer engine, Ohnrscript guarantees **100% deterministic calculations** across heterogeneous data centers.

---

## Performance Benchmarks

Ohnrscript's architecture structurally eliminates runtime overhead, resulting in execution speeds that approach theoretical hardware limits.

### Why is this possible? The O(1) Memory Scaling Law
When standard runtimes (V8) parse data or validate schemas, they instantiate massive, short-lived object trees. Under concurrent load, this "Heap Churn" triggers violent, stop-the-world GC pauses that cascade into server crashes.

Ohnrscript mathematically breaks the O(N) hardware scaling laws of web development by enforcing an **O(1) Memory Scaling Architecture**:

- **Zero-Allocation Decoding:** Data is never instantiated into a dynamic object tree. Accessors read directly from physical memory offsets via static `Uint8Array` memory slabs.
- **AOT Fused Validation:** Schema bounds (e.g., length limits, integer maximums) are baked directly into the byte-offset read cycle. The binary throws a validation error *before* memory is ever allocated for a malicious payload.
- **Monomorphic JIT Stability:** Because Ohnrscript variables map directly to fixed-byte offsets instead of dynamic JavaScript objects, the V8 Turbofan compiler maintains 100% monomorphic Inline Caches, eliminating all polymorphic thrashing and JIT deoptimizations.

| Benchmark Name | Iterations | Standard Stack Result | Ohnrscript Result | Speedup Factor | Heap Memory Delta |
|---|---|---|---|---|---|
| **AI Vector Processing** (1536 floats) | 100,000 | 194.86 ms (DataView) <br> 13,279.23 ms (JSON) | **3.50 ms** | **55.70x** vs Binary <br> (3,791x vs JSON.parse) | 10.82 MB |
| **Cryptographic UUID** (`ohn-uuid`) | 5,000,000 | 5,438.36 ms | **119.98 ms** | **45.33x** | 0.96 MB |
| **CBOR Parsing** (`ohn-cbor`) | 100,000 | 640.30 ms | **36.42 ms** | **17.58x** | 0.00 MB |
| **40-Field Payload Parse** | 100,000 | 2,684.75 ms | **235.23 ms** | **11.41x** | 0.00 MB |
| **API Pipeline** (Parse+Validate+UUID) | 1,000,000 | 431.21 ms | **98.58 ms** | **4.37x** | -6.75 MB (Less) |
| **WebSocket Frame Parsing** (`ohn-ws`) | 2,000,000 | 163.16 ms | **67.06 ms** | **2.43x** | -13.16 MB (Less) |
| **Cookie Parsing** (`ohn-cookie`) | 2,000,000 | 1,742.24 ms | **756.67 ms** | **2.30x** | 0.93 MB |
| **AOT Schema Validation** (`ohn-zod`) | 1,000,000 | 6,001.97 ms | **2,692.14 ms** | **2.23x** | -28.90 MB (Less) |
| **614 MB Payload Heap** (Explosion) | 100,000 | *Fatal Crash* (String Limit) | **Success** | **$\infty$** | 0.55 MB |
| **2 GB Code Emission** (31.1M nodes) | 1 | *Fatal Crash* (String Limit) | **1.90 s** | **$\infty$** | 37.00 KB |
| **Parser Object Allocation** (`ohn-parser`) | 100,000 | 22.7 million objects | **0 objects** | **N/A** | -3.32 KB |

### Key Engineering Breakthroughs
While the raw throughput multiplier is impressive, the true value of Ohnrscript lies in its ability to bypass physical hardware limitations that traditionally crash standard web runtimes:

- **Bypassing the V8 String Limit:** Standard Node.js crashes (`ERR_STRING_TOO_LONG`) when attempting to synchronously parse a 614 MB AI vector payload because expanding it to JavaScript `Number` objects requires >2GB of physical RAM. By pointing a zero-copy `Float32Array` directly at the underlying network buffer, Ohnrscript processes the entire payload with a **0.55 MB Heap Delta**.
- **Tail-Latency Stability:** Under a sustained 10,000 connection concurrent network assault, standard Node.js suffers erratic p99.99 latency spikes (up to 1,925ms) due to GC sweeps. Because Ohnrscript allocates zero objects per request, it bypasses the Garbage Collector entirely, maintaining a rock-solid, predictable latency ceiling under extreme I/O pressure.
- **The Zero-Allocation Compiler:** The Ohnrscript self-hosted Lexer and Parser can process 100,000 AST nodes with a **negative heap delta (-3.32 KB)**. By utilizing a Data-Oriented Design (DOD) Arena and an Open-Addressed Hash Table for its symbol pool, the compiler allocates exactly 0 objects, effectively starving the V8 Garbage Collector.

---

## Architectural Prior Art

Ohnrscript does not compete with web bundlers or JavaScript runtimes; it competes with systems programming languages and kernel-bypass architectures.

| Paradigm / Project | How Ohnrscript Compares |
|---|---|
| **Rust & C++** (Systems Languages) | Ohnrscript achieves similar bare-metal execution speeds and strict memory layouts, but retains the ergonomic, C-style syntax of JavaScript without the friction of a Borrow Checker. |
| **Unikernels** (MirageOS, IncludeOS) | Like MirageOS, `ohn-kernel` compiles the application and the kernel into a single bootable image, but it brings unikernel architecture to the massive web-developer ecosystem rather than relying on OCaml or C++. |
| **DPDK / SPDK** (Kernel-Bypass I/O) | Enterprise libraries like Intel's SPDK bypass the Linux kernel for raw hardware speed. Ohnrscript bakes this philosophy directly into its standard library (e.g., `db.ohn` speaking LBA directly to disk, bypassing ext4). |
| **Zig** (DOD & Manual Memory) | Ohnrscript shares Zig's Data-Oriented Design (DOD) philosophy and lack of hidden memory allocation, but applies it specifically to cross-compiling web-native payloads to raw physical memory. |
| **Static Hermes / AssemblyScript** | While these compile JS/TS to native binaries or WASM, they still rely on a host OS (Linux) or VM. Ohnrscript LLVM compiles to a sovereign x86/ARM64 hardware image with zero OS overhead. |

---

## Licensing & Deployment

Ohnrscript operates under a **Business Source License (BUSL 1.1)** model.
We believe that core systems infrastructure should eventually belong to the open-source ecosystem, but we also believe in protecting our architecture from being freely monetized by hyperscalers while we build a sustainable business. 

This model provides a "Source-Available Now, Open-Source Later" pipeline:

### The Free Tier
You may use Ohnrscript in production completely for free if your organization meets **all** of the following criteria:
1. You have less than **$500,000 USD** in gross annual revenue and total raised capital.
2. You are not building a managed competitive service (e.g., a PaaS or DBaaS based on Ohnrscript).
3. You are not building custom physical silicon or hardware to natively accelerate Ohnrscript. 

*To view our pricing tiers or purchase a Commercial License, please visit [[ohnrshyp.com/#/connect](https://ohnrshyp.com/#/connect)].*
*For inquiries or custom licensing, contact [support@ohnrshyp.com](mailto:support@ohnrshyp.com).*

### The Open-Source Change Date
Exactly 5 years from today (**July 8, 2031**), this version of the Ohnrscript toolchain will automatically transition to the **Mozilla Public License, version 2.0 (MPL-2.0)**, becoming true Open Source Software.
For full legal definitions and constraints, please read the [LICENSE.md](LICENSE.md) file.

---
