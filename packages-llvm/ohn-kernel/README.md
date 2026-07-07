# Ohnrscript Kernel v1.0

**The first HTTP-serving unikernel compiled from JavaScript syntax to bare-metal x86 machine code via LLVM IR — no JavaScript runtime, no garbage collector, no operating system.**

---

## What This Is

`ohn-kernel` is a bare-metal x86 unikernel whose entire network stack — from VirtIO driver to TCP state machine to HTTP response — is written in Ohnrscript's JavaScript syntax and compiled to native machine code via LLVM IR. It boots via Multiboot on SeaBIOS/QEMU, initializes its own VirtIO-net driver, implements TCP, and serves HTTP responses. The compiled ELF binary is **64KB**.

This is not a simulation. QEMU is a hardware emulator. The kernel executes the same x86 machine code it would execute on physical hardware. When you `curl http://localhost:8080`, the HTTP response comes from a kernel running in ring 0 with no OS beneath it.

---

## Quick Start (Docker)

```bash
# From the ohnrscript repo root:
docker build -t ohn-kernel .
docker run -it --rm -p 8080:8080 ohn-kernel

# In another terminal:
curl http://localhost:8080
# → OK
```

No LLVM, no QEMU install, no build tools required. Docker handles everything.

---

## The Claim

> *"Ohnrscript Kernel v1.0 is the first HTTP-serving unikernel compiled from JavaScript syntax to LLVM IR to bare-metal x86 native machine code, executing in ring 0 without a JavaScript runtime, garbage collector, or operating system."*

This claim is precise and defensible:

- **JavaScript syntax** — `kernel.ohn`, `tcp.ohn`, `http.ohn` are standard Ohnrscript source, readable as JavaScript
- **LLVM IR** — all `.ll` files are emitted by the Ohnrscript LLVM generator, not hand-written
- **Native machine code** — compiled by `clang -O2 -target i386-elf -ffreestanding`, no JIT, no interpretation
- **Ring 0** — Multiboot loads the ELF and executes it in x86 privileged mode
- **No runtime** — no V8, no Node.js, no SpiderMonkey, no JavaScriptCore
- **No operating system** — no Linux, no POSIX, no syscalls. The kernel IS the operating system.
- **Boot shim is infrastructure** — `boot.c` sets up the stack, IDT, PIC, and multiboot header (equivalent to `crt0.o` in any C program). All kernel logic is in `.ohn` files.

---

## Architecture: FOH/BOH Polling Model

The kernel uses a **Front of House / Back of House (FOH/BOH)** architecture — a strict separation between I/O handling and packet processing:

```
┌────────────────────────────────────────────────────┐
│                   POLL LOOP                         │
│                                                    │
│  ┌──────────────┐         ┌──────────────────────┐ │
│  │  FOH (Front)  │ ──────▶ │  BOH (Back)          │ │
│  │               │         │                      │ │
│  │  VirtIO RX    │         │  TCP State Machine   │ │
│  │  Descriptor   │         │  HTTP Parser/Router  │ │
│  │  Processing   │         │  Response Assembly   │ │
│  │               │         │  VirtIO TX Kick      │ │
│  └──────────────┘         └──────────────────────┘ │
└────────────────────────────────────────────────────┘
```

- **FOH** polls VirtIO receive descriptors, classifies packets (ARP vs IP/TCP), and dispatches to the appropriate handler
- **BOH** processes TCP segments through a full state machine (SYN → SYN-ACK → ESTABLISHED → FIN), parses HTTP requests, routes them, and assembles responses
- **No interrupts in the hot path** — the polling model eliminates context switch overhead entirely
- **Single HTTP pass** — one request per poll cycle, designed for Firecracker-style micro-VM deployment where the hypervisor manages concurrency

---

## What the Kernel Does

1. **Boots via Multiboot** on SeaBIOS — sets up IDT, PIC, stack
2. **Scans the PCI bus** — discovers VirtIO-net device
3. **Initializes VirtIO driver** — negotiates features, configures receive/transmit ring buffers
4. **Sends gratuitous ARP** — announces MAC/IP to the network
5. **Enters FOH/BOH poll loop** — polls VirtIO RX descriptors continuously
6. **Handles ARP** — responds to ARP requests for IP resolution
7. **Implements TCP** — full SYN/SYN-ACK/ACK/FIN state machine with sequence number tracking
8. **Parses HTTP requests** — extracts method, path, headers from TCP payload
9. **Routes and responds** — returns HTTP response via VirtIO TX ring
10. **Serves traffic** — `curl http://localhost:8080` → `OK`

---

## Linked Ecosystem Packages

The kernel links Ohnrscript ecosystem packages at compile time, compiled from the same `.ohn` source through the same LLVM pipeline:

| Package | Source | Purpose |
|---|---|---|
| `network_parser.ohn` | `src/network_parser.ohn` | Ethernet/IP/TCP header parsing via byte-level typed array access |
| `tcp.ohn` | `src/tcp.ohn` | Full TCP state machine (20,926 bytes of Ohnrscript) |
| `http.ohn` | `packages-llvm/node.ohn/src/http.ohn` | HTTP request parsing and response assembly |
| `router.ohn` | `packages-llvm/node.ohn/src/router.ohn` | URL path routing |
| `db.ohn` | `packages-llvm/db.ohn/src/db.ohn` | Raw block storage (no filesystem) |

All six `.ohn` files compile to LLVM IR, are validated by `llvm-as`, compiled to `.o` object files, and linked into a single 64KB ELF binary.

---

## Deployment

The kernel is a **unikernel** — the application and the kernel are the same binary. This makes it ideal for:

- **Firecracker micro-VMs** — boot a dedicated micro-VM per workload in microseconds
- **Edge computing** — 64KB binary, 32MB RAM footprint, boots instantly
- **RAG retrieval** — combine with `ohn-vector-native` and `db.ohn` for bare-metal vector search
- **Zero-attack-surface infrastructure** — no shell, no filesystem, no login, no SSH. The only interface is the HTTP port.

---

## File Structure

```
ohn-kernel/
  src/
    kernel.ohn              ← FOH/BOH poll loop, VirtIO driver, PCI scan (25KB)
    tcp.ohn                 ← TCP state machine (21KB)
    network_parser.ohn      ← Ethernet/IP/TCP header parsing (15KB)
  boot/
    boot.c                  ← Infrastructure: multiboot header, IDT, PIC, stack
    linker.ld               ← Linker script: places binary at 1MB
  dist/
    kernel.ll               ← LLVM IR (generated)
    tcp.ll                  ← LLVM IR (generated)
    network_parser.ll       ← LLVM IR (generated)
    http.ll                 ← LLVM IR (generated, from packages-llvm/node.ohn)
    router.ll               ← LLVM IR (generated, from packages-llvm/node.ohn)
    db.ll                   ← LLVM IR (generated, from packages-llvm/db.ohn)
    kernel.elf              ← Final bootable ELF binary (64KB)
  build.sh                  ← Full pipeline: 6× .ohn → .ll → .o → kernel.elf
  verify.sh                 ← Automated verification suite
  README.md
```

---

## Build Requirements

- **Node.js** ≥ 18 (to run the Ohnrscript LLVM generator)
- **clang** with x86-elf cross-compilation support
  - macOS: `brew install llvm`
  - Linux: `apt install clang-16 lld-16 llvm-16`
- **llvm-as** (LLVM IR validator, comes with LLVM)
- **qemu-system-i386** (to boot and test)
  - macOS: `brew install qemu`
  - Linux: `apt install qemu-system-x86`

Or skip all of the above and use Docker (see Quick Start).

---

## Build & Run (Without Docker)

```bash
cd packages-llvm/ohn-kernel

# Build the kernel ELF
./build.sh

# Build and boot in QEMU
./build.sh run

# Clean build artifacts
./build.sh clean
```

---

## Verification

```bash
# Verify all LLVM IR files are valid
for f in dist/*.ll; do llvm-as "$f" -o /dev/null && echo "PASS: $f"; done

# Verify zero unsupported constructs
grep -c '; UNSUPPORTED' dist/*.ll
# Expected: 0 for all files

# Check the binary size
wc -c dist/kernel.elf
# Expected: ~64KB

# HTTP verification (with kernel running)
curl http://localhost:8080
# Expected: OK
```

---

## The Build Pipeline

```
kernel.ohn ─┐
tcp.ohn ────┤
network_parser.ohn ─┤    node (Ohnrscript LLVM generator)
http.ohn ───┤        parser.ohn → parse → AST
router.ohn ─┤        generator-llvm.ohn → walk AST → emit LLVM IR
db.ohn ─────┘
    │
    ▼
6× .ll files  ← LLVM IR text (validated by llvm-as)
    │
    │  clang -target i386-elf -ffreestanding -O2
    ▼
6× .o files   ← i386 ELF object files
    │
    │  (simultaneously)
boot.c ──────→ boot.o (multiboot header + IDT + PIC + stack)
    │
    │  ld.lld -T linker.ld
    ▼
kernel.elf ← bootable ELF at 0x100000 (64KB)
    │
    │  qemu-system-i386 -kernel kernel.elf
    ▼
SeaBIOS → Multiboot → _start (boot.o)
    → IDT + PIC → kernelMain (kernel.o)
    → PCI scan → VirtIO init → ARP → POLL loop
    → TCP handshake → HTTP response → curl receives "OK"
```

---

## Prior Art Comparison

| Project | Approach | Why it's different |
|---|---|---|
| **Bun `--compile`** | Bundles JavaScriptCore engine | JS engine runs underneath |
| **AssemblyScript** | TypeScript → WebAssembly | WASM requires a VM |
| **Porffor** | Experimental research | Not kernel-capable |
| **NectarJS** | Bundles V8 | Engine runs underneath |
| **MirageOS** | OCaml unikernel | Not JavaScript syntax |
| **IncludeOS** | C++ unikernel | Not JavaScript syntax |
| **Every C kernel** | C → clang → ELF | Not JavaScript syntax |
| **Ohnrscript Kernel** | JS syntax → LLVM IR → ELF → ring 0 → HTTP | **This** |

---

## The Path from v0.1 to v1.0

v0.1 was a proof-of-concept that cleared the VGA buffer and wrote a boot banner. Since then:

| Milestone | What It Unlocked |
|---|---|
| `break`/`continue` in LLVM generator | FOH/BOH polling loops |
| FFI external calls | PCI bus scan, VirtIO driver, ARP |
| `obj.prop` struct access | TCP state machine, socket state tracking |
| Multi-module linking | Ecosystem packages (http.ohn, router.ohn, db.ohn) |
| VirtIO-net driver | Network I/O without a NIC driver from an OS |
| TCP state machine | Full SYN/SYN-ACK/ACK/FIN handshake |
| HTTP parsing & routing | Serving real HTTP traffic from bare metal |
| Docker packaging | One-command evaluation for anyone |

---

## Historical Context

On August 25, 1991, Linus Torvalds posted:
> *"I'm doing a (free) operating system (just a hobby, won't be big and professional like gnu)"*

What he released was a kernel — not a full OS. It booted, managed hardware, ran programs. That was enough.

Ohnrscript Kernel v1.0 is the same category of moment for JavaScript-native systems programming: proof that the compilation path works, that JavaScript syntax can produce ring-0 native machine code, and that a unikernel written in JavaScript syntax — compiled without a JavaScript engine — is not a theoretical possibility but a demonstrated, curl-able fact.
