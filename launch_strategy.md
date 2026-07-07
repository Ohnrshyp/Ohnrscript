# Ohnrscript Launch Strategy

Launching a systems language and kernel is different from launching a standard JS framework. The audience is highly technical, deeply skeptical of performance claims, and hypersensitive to "marketing speak." 

Your strength is that the claims are true, and the Docker quickstart proves it in 30 seconds. This document provides the drafts and outreach strategy.

---

## 1. Show HN (Hacker News) Draft

**Title:** Show HN: Ohnrscript – An HTTP unikernel written in JavaScript syntax

**Body:**
> I’ve spent the last few years building Ohnrscript — a strictly typed, ahead-of-time (AOT) compiler that takes standard JavaScript class syntax and compiles it to bare-metal x86 machine code via LLVM IR.
>
> To prove the architecture, we built `ohn-kernel`. It’s a 64KB unikernel that boots via Multiboot, initializes a VirtIO-net driver, implements a full TCP state machine, and serves HTTP responses. All of this logic is written in `.ohn` files (JavaScript syntax) and compiled directly to an ELF binary. 
> 
> **There is no V8, no Node.js, no Garbage Collector, and no underlying Linux OS.**
>
> We built this because modern compute—especially high-frequency API routing and AI vector processing—suffers from massive GC pauses and context-switching overhead. By eliminating the runtime and enforcing a strict `i32` Data-Oriented Design memory arena, we've bypassed those hardware scaling laws. In our benchmarks, parsing a 1536-float AI vector payload is 55x faster than a V8 binary `DataView` (and 3,700x faster than `JSON.parse`).
>
> Because there are no hardware floating-point units in our bare-metal kernel, we also built a custom 26+6 bit-packed fixed-point math engine, ensuring 100% deterministic execution across all CPU architectures.
>
> You can boot the kernel via Docker and `curl` it in about 30 seconds:
> ```bash
> docker build -t ohn-kernel .
> docker run -it --rm -p 8080:8080 ohn-kernel
> # In another terminal: curl http://localhost:8080
> ```
>
> Repo: https://github.com/ohnrshyp/ohnrscript
> I’ll be hanging around to answer any questions about the LLVM compiler pipeline, the memory model, or the unikernel architecture.

---

## 2. Dev.to Post Draft

**Title:** I wrote a bare-metal HTTP kernel in JavaScript (and threw away the V8 engine)

**Body:**
*(The tone here should be slightly more narrative and educational than Hacker News.)*

If you write JavaScript or TypeScript, you are used to the runtime doing the heavy lifting. V8 or JavaScriptCore handles memory allocation, garbage collection, and JIT compilation. You don't think about the physical RAM your object takes up.

But what if you removed the runtime entirely? What if you took JavaScript syntax and compiled it directly to bare-metal x86 machine code, running in Ring 0 without Linux underneath it?

That’s what I built with **Ohnrscript**.

Ohnrscript is a dual-compiling language. It enforces a strict Data-Oriented Design (DOD) where everything is a 32-bit integer (`i32`). There are no dynamic objects, no prototype chains, and no GC. 

To prove it works, we built `ohn-kernel`. It’s a 64KB HTTP-serving unikernel. It boots, scans the PCI bus, initializes a VirtIO network driver, handles the TCP handshake, and serves an HTTP response. All of this logic is written in `.ohn` files (which you can read like standard JS) and compiled via LLVM IR to a native ELF binary.

### How it works:
1. **The DOD Arena:** Memory is managed manually via contiguous `Int32Array` buffers. No `new Object()`.
2. **The LLVM Generator:** Instead of transpiling to C, the Ohnrscript AST maps directly to LLVM IR registers. `let x = 5 | 0` becomes a native `i32` allocation.
3. **The FOH/BOH Architecture:** The kernel uses a Front-of-House / Back-of-House polling loop, bypassing interrupts entirely for massive throughput.

### Why do this?
When you eliminate the V8 engine and the Linux context-switching overhead, the performance gains are absurd. Our benchmarks show vector parsing executing 55x faster than highly-optimized Node.js binary parsers. For enterprise hyperscalers and AI data centers, this O(1) memory scaling architecture prevents the catastrophic GC-pause crashes that plague heavy Node pipelines.

You can test the bare-metal kernel yourself using Docker:
```bash
docker build -t ohn-kernel .
docker run -it --rm -p 8080:8080 ohn-kernel
```

Check out the repo here: [https://github.com/ohnrshyp/ohnrscript](https://github.com/ohnrshyp/ohnrscript)

Let me know what you think in the comments!

---

## 3. Targeted Outreach List (The "Who to Tell" List)

Beyond public posts, you should send direct, short emails to key figures in the systems/JS ecosystem. Keep the emails under 5 sentences. Lead with the Docker command.

### The JavaScript Systems Innovators
These people are pushing the boundaries of JS performance and will immediately understand the technical achievement of an LLVM JS-syntax unikernel:
- **Jarred Sumner (Bun):** He is obsessed with JS performance and Zig-based DOD.
- **Ryan Dahl (Deno/Node.js):** The creator of the original JS server runtime. 
- **Jared Palmer (Vercel/Turbopack):** Focuses heavily on AOT compilation and Rust/JS boundaries.

### The Hyperscaler / Micro-VM Teams
These teams care deeply about unikernels, micro-VMs, and cold-start times:
- **AWS Firecracker Team:** The engineers building the micro-VM infrastructure for AWS Lambda. Ohn-kernel is practically purpose-built for Firecracker.
- **Fly.io Engineering Team:** Thomas Ptacek and team write extensively about V8 isolates vs. Firecracker VMs. They will love the FOH/BOH polling model.
- **Cloudflare Workers Team:** Kenton Varda (creator of Cap'n Proto). They use V8 isolates, but Ohnrscript's zero-allocation model and `ohnrbuffs` are right up their alley.

### AI Infrastructure Teams
- **Pinecone / Weaviate / Qdrant:** Engineering leads at vector database companies. Show them the 55x vector parsing benchmark and the 26+6 bit-packed FPU bypass.

## 4. GitHub Language Classification Fix

By default, GitHub's Linguist will see `.ohn` files as plain text or try to guess. To fix this without requiring a massive PR to the GitHub Linguist repo, I have created a `.gitattributes` file in the root of your repo:

```
*.ohn linguist-language=JavaScript linguist-vendored
```

**What this does:**
1. `linguist-language=JavaScript`: Tells GitHub to use JavaScript syntax highlighting when someone views an `.ohn` file.
2. `linguist-vendored`: Tells GitHub to **exclude** these files from the repository's language statistics bar. 

This is the perfect middle ground. Your code gets beautiful syntax highlighting, but the repo won't falsely claim to be "100% JavaScript", protecting your positioning as a native systems language.
