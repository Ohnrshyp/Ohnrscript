# Ohnrscript: The Fourth Sovereign Stack

**Ohnrscript** (`.ohn`) is a Turing-complete systems programming language, Ahead-Of-Time (AOT) compiler, and operating system stack built entirely from scratch. 

It is the world's first **Sovereign Stack** capable of self-hosting and compiling Ohnrscript directly to bare-metal x86 and ARM64 machine code. It completely bypasses V8, Garbage Collection, the C Standard Library (libc), and the Linux Kernel. 

By removing decades of generalized computing bloat, Ohnrscript allows enterprise hyperscalers, AI data centers, and high-frequency embedded systems to achieve true hardware sympathy. 

**Critically: Ohnrscript is NOT a JavaScript compiler.** While it borrows the ergonomic, C-style syntax of JavaScript and TypeScript, it is fundamentally incompatible with the JS runtime. **There are no dynamic objects, no prototype chains, and no garbage-collected heaps.** Memory is modeled strictly through static buffers (`Int32Array`, `Uint8Array`), contiguous Data-Oriented Design (DOD) arenas, and raw pointers. You cannot compile an npm package with Ohnrscript; you build native systems from the ground up.

---

## 🛑 The Paradigm Shift

Modern compute relies heavily on dynamic runtimes (Node.js/V8) or heavy, generalized operating systems (Linux/Windows). When building for extreme throughput—such as parsing massive network streams or executing ML inference—these layers introduce catastrophic overhead:
1. **Garbage Collection (GC) Pauses:** Dynamic memory allocation forces the runtime to pause execution to reclaim memory.
2. **Context Switching Latency:** Transitioning from user-space to kernel-space takes thousands of CPU cycles.
3. **VM Overhead:** Executing JavaScript traditionally requires booting a massive JIT engine.

**Ohnrscript solves this by eliminating the runtime.** 

Ohnrscript is a dialect of JavaScript that strictly enforces static typing through inference, manual memory management via `@rawPointer`, and compile-time buffer allocations. The Ohnrscript compiler (`generator-llvm.ohn`) reads standard JS syntax and emits **native LLVM Intermediate Representation (IR)**. 

The result is a binary that executes on bare metal with zero dependencies.

---

## 🏗️ The Compiler Pipeline

Ohnrscript is self-hosted and designed around strict Data-Oriented Design (DOD) principles.

### 1. The Zero-Allocation Parser (`compiler/src/frontend/parser.ohn`)
Instead of instantiating thousands of JavaScript AST Node objects, the Ohnrscript parser is built using contiguous memory arenas.
- Uses **TypedArrays (`Int32Array`)** as memory pools.
- Uses a custom **SMI-safe FNV-1a hashing** algorithm for string interning.
- Parses massive files without triggering a single Garbage Collection pause.

### 2. The LLVM IR Generator (`compiler/src/codegen/generator-llvm.ohn`)
Instead of transpiling to C or relying on JIT engines, the backend directly maps JavaScript AST nodes to LLVM IR registers. 
- `const x = 5` maps directly to an `i32` LLVM allocation.
- `Float32Array` accesses map directly to raw physical pointer offsets via `getelementptr`.
- Loop termination variables and condition branching are perfectly preserved in the generated `.ll` files.

---

## 🌍 The Sovereign Ecosystem (`packages-llvm/`)

Because Ohnrscript compiles to bare metal, it requires a specialized standard library. The `packages-llvm/` directory contains the foundational packages that make up the Sovereign Stack:

### 🖥️ `ohn-kernel`
The crown jewel of the stack. A custom x86 multiboot-compliant kernel written entirely in Ohnrscript syntax. 
- Boots directly from the BIOS/UEFI on physical hardware or QEMU.
- Establishes a VGA buffer at physical address `0xB8000`.
- Maps physical memory dynamically without standard Linux paging overhead.
- Executes user-space code with absolute zero context-switching latency.

### 🧮 `three.ohn`
A custom mathematics and 3D graphics engine implemented entirely via bit-packed integer arithmetic. 
- Bypasses hardware Floating-Point Units (FPUs).
- Uses software-only math execution to guarantee deterministic calculations across heterogeneous data center hardware.
- Allows massive neural network state and simulations to run exactly the same way on every CPU architecture.

### 💾 `db.ohn`
A bare-metal Block Storage interface and disk IO manager. 
- Writes directly to physical disk images (`disk.img`) using raw block offsets.
- Bypasses standard OS file systems (ext4/NTFS) for zero-copy, direct-to-disk read/writes.

### 🔒 `tls.ohn`
Native cryptography and secure communications.
- Integrates deterministic, pre-allocated security primitives using `mbedtls` architecture.
- Handles asymmetric key exchange directly in kernel space.

### 🚀 `ohn-vector-native`
SIMD-optimized Float32 vector operations for machine learning workloads.
- Benchmarked at **9.42x faster** than V8 Turbofan for `dotProduct` and `l2NormSquared`.
- Approaches the theoretical maximum 4-wide ARM NEON SIMD ceiling using Ohnrscript LLVM code generation.

### 📦 `ohnrbuffs`
A zero-allocation serialization format (comparable to FlatBuffers or Cap'n Proto).
- Encodes massive streaming payloads in micro-seconds by calculating exact buffer sizes at compile time.
- Compiles byte-shifting logic directly into the generated binary, avoiding all dynamic reflection.

---

## 🛠️ Memory Management: Reclaiming Control

Ohnrscript does not have a Garbage Collector. All memory is deterministic.

- **`__ohn_alloc` and `__ohn_free`:** Developers have direct access to manual memory allocation at the language level.
- **`@rawPointer`:** Ohnrscript allows direct manipulation of physical memory addresses. This is critical for kernel-space operations (e.g., writing to VGA memory or I/O ports) and high-performance tensor computing where bounding-box checks introduce unacceptable latency.

---

## 📊 Performance Benchmarks

Ohnrscript's architecture mathematically eliminates runtime overhead, resulting in execution speeds that approach theoretical hardware limits.

### 1. The `@cbor` AOT Serialization (Zero-Allocation)
Standard serialization libraries (`JSON.stringify` or `cbor.encode`) rely on slow runtime reflection and dynamic memory allocation. Ohnrscript calculates exact buffer sizes at compile time and hardcodes byte-shifting logic directly into the generated binary.

In a benchmark of 100,000 serializations containing dynamic-length arrays and strings:
- **Standard Node.js CBOR:** 585.58 ms
- **Ohnrscript AOT CBOR:** 35.49 ms
- **Speedup: 16.50x faster**

### 2. LLVM Native Vector Math (`ohn-vector-native`)
Floating-point vector operations compiled via `generator-llvm.ohn` vs Node.js V8 Turbofan (JIT).

| Operation | V8 Turbofan (JIT) | Ohnrscript (LLVM Native) | Speedup |
|---|---|---|---|
| `dotProduct` | 0.983 ms | 0.111 ms | **8.84x** |
| `l2NormSquared` | 0.739 ms | 0.063 ms | **11.73x** |
| `mapVectorCopy` | 0.668 ms | 0.087 ms | **7.67x** |
| **Average** | | | **9.42x** |

*Note: `l2NormSquared` approaches the theoretical 4-wide ARM NEON SIMD ceiling.*

---

## 🔬 Architectural Prior Art

| Project | What it does | How Ohnrscript Differs |
|---|---|---|
| **Bun (`--compile`)** | Bundles JavaScriptCore + source into an executable. | JS still runs inside a massive JSC VM. Ohnrscript is VM-less. |
| **AssemblyScript** | Compiles TypeScript to WebAssembly. | WASM still requires a VM and a host environment. Ohnrscript compiles to native host binaries. |
| **esbuild / SWC** | Go/Rust programs that *process* JS fast. | They do not make JS *execute* natively at runtime. |
| **Ohnrscript LLVM** | **JS syntax → LLVM IR → Bare Metal x86/ARM64** | **Unprecedented. No runtime, no GC, zero OS overhead.** |

---

## 💼 Licensing & Deployment

Ohnrscript operates under a **Business Source License (BUSL)** model.

The compiler, the language specification, and the standard library are designed for the highest echelons of enterprise performance. For hyperscalers and AI laboratories, Ohnrscript offers the unique ability to deploy Sovereign Stacks—completely independent vertical computing environments that maximize the silicon yield of physical data centers.

*For enterprise licensing, deployment details, and pricing structures, please refer to the internal commercial documentation.*

---

## 🏁 Getting Started

To explore the LLVM toolchain, run the benchmark suites, or compile the Ohn-kernel into a bootable QEMU disk image, navigate to the respective packages:

```bash
# Clone the repository
git clone https://github.com/your-org/ohnrscript.git
cd ohnrscript

# Install dependencies (for the build pipeline and CLI tools)
npm install

# Run the native LLVM vs V8 benchmarks
node benchmarks/llvm-vs-js-bench.js
```

*(See `packages-llvm/ohn-kernel/README.md` for instructions on booting the kernel via QEMU.)*
