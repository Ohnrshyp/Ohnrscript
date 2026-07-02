# node.ohn — Native Web Server Runtime

A production-grade, natively-compiled web server written entirely in **Ohnrscript** — a strict, AOT-compiled systems programming language. It bypasses the V8 engine, Libuv, and the Node.js runtime entirely.

## Architecture

```
server.ohn (SO_REUSEPORT fork logic)
    └── loop.ohn (kqueue/epoll event loop + DOD socket state machine)
            └── bindings.c (C ABI shim: POSIX structs → flat i64 primitives)
                    └── clang -O3 → node.ohn (native binary)
```

The Ohnrscript source is compiled by the **self-hosted Ohnrscript compiler** (not Babel, not Node). The compiler emits raw LLVM IR. `clang -O3` then compiles and links this against `bindings.c` to produce a fully standalone native executable.

## Build

```bash
chmod +x build.sh && ./build.sh
```

Requires: LLVM/clang, Node.js (to run the self-hosted compiler itself).

## Run

```bash
./dist/node.ohn
# Listening on 0.0.0.0:8080
```

## Benchmark

```bash
# Install wrk: brew install wrk
wrk -t4 -c10000 -d30s http://localhost:8080
```

## Architecture Highlights

| Feature | Mechanism |
|---|---|
| Multi-core scaling | `SO_REUSEPORT` fork — OS kernel load balances |
| ABI safety | `bindings.c` shim — zero LLVM struct padding risk |
| Connection timeouts | Min-Heap $O(1)$ eviction (Slowloris mitigation) |
| Outbound pressure | High-Water Mark → `res.write()` returns `false` |
| TLS + sendfile | Conditional zero-copy (kTLS or mmap fallback) |
| Thread IPC | Lock-free MPSC Queue + single-byte `eventfd` wakeup |
| Graceful teardown | `SIGTERM` → Draining Phase → `exit(0)` |
| Memory | DOD fixed Ring Buffers — zero dynamic allocation |
