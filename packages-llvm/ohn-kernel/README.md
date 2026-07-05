# Ohnrscript Kernel v0.1

**The first kernel compiled from JavaScript syntax to native x86-64 machine code via LLVM IR — no JavaScript runtime, no garbage collector, no engine.**

---

## What This Is

`ohn-kernel` is a bare-metal x86-64 kernel whose logic is written in Ohnrscript's JavaScript class syntax and compiled directly to native machine code via the Ohnrscript LLVM IR generator. It boots from GRUB, executes in ring 0 (kernel privilege mode), and performs real hardware I/O — writing directly to the VGA text buffer at physical address `0xB8000` — with no operating system beneath it.

This is not a simulation. QEMU is a hardware emulator. The kernel executes the same x86-64 machine code it would execute on physical hardware.

---

## The Claim

> *"Ohnrscript Kernel v0.1 is the first kernel whose logic is compiled from JavaScript syntax to LLVM IR to bare-metal x86-64 native machine code, executing in ring 0 without a JavaScript runtime, garbage collector, or bundled engine."*

This claim is precise and defensible:

- **JavaScript syntax** — `kernel.ohn` is standard Ohnrscript source, readable as JavaScript
- **LLVM IR** — `kernel.ll` is emitted by the Ohnrscript LLVM generator, not hand-written
- **Native machine code** — compiled by `clang -O2 -target x86_64-elf`, no JIT, no interpretation
- **Ring 0** — GRUB loads the ELF and executes it in x86-64 privileged mode
- **No runtime** — no V8, no Node.js, no SpiderMonkey, no JavaScriptCore
- **Boot shim is infrastructure** — `boot.c` sets up the stack and multiboot header (equivalent to `crt0.o` in any C program). The kernel logic is in `kernel.ohn`.

---

## Prior Art Comparison

| Project | Approach | Why it's different |
|---|---|---|
| **Bun `--compile`** | Bundles JavaScriptCore engine | JS engine runs underneath |
| **AssemblyScript** | TypeScript → WebAssembly | WASM requires a VM |
| **Porffor** | Experimental research | Not kernel-capable |
| **NectarJS** | Bundles V8 | Engine runs underneath |
| **Every C kernel** | C → clang → ELF | Not JavaScript syntax |
| **Ohnrscript Kernel** | JS syntax → LLVM IR → ELF → ring 0 | **This** |

---

## What the Kernel Does

1. **Clears the VGA text buffer** — 4,000 bytes, 80×25 cells, direct hardware write via GEP
2. **Writes a boot banner** — "OHNRSCRIPT KERNEL v0.1 | Compiled from JavaScript via LLVM IR | No Runtime" in white
3. **Writes a separator line** — dark gray
4. **Writes a status message** — "[ OK ] Kernel loaded. No JavaScript runtime. No GC. No engine. Ring 0." in bright green
5. **Runs a memory integrity scan** — reads all 4,000 bytes of the VGA buffer, computes a checksum
6. **Displays the checksum** in hex on screen — bright green
7. **Writes a halt message** — "[ -- ] System halted. Ohnrscript kernel complete."
8. **Halts** — infinite `hlt` loop

---

## File Structure

```
ohn-kernel/
  src/
    kernel.ohn          ← Ohnrscript source — kernel logic (JavaScript syntax)
  boot/
    boot.c              ← Infrastructure: multiboot2 header, stack setup, calls kernelMain
    linker.ld           ← Linker script: places binary at 1MB, multiboot header first
  dist/
    kernel.ll           ← LLVM IR emitted by Ohnrscript generator (generated)
    kernel.o            ← Compiled kernel object (generated)
    boot.o              ← Compiled boot shim object (generated)
    kernel.elf          ← Final bootable ELF binary (generated)
  build.sh              ← Full pipeline: .ohn → .ll → .o → .elf
  README.md
```

---

## Build Requirements

- **Node.js** ≥ 18 (to run the Ohnrscript LLVM generator)
- **clang** with x86_64-elf cross-compilation support
  - macOS: `brew install llvm`
  - Linux: `apt install clang lld`
- **llvm-as** (LLVM IR validator, comes with LLVM)
- **qemu-system-x86_64** (to boot and test)
  - macOS: `brew install qemu`
  - Linux: `apt install qemu-system-x86`

---

## Build & Run

```bash
cd packages-llvm/ohn-kernel

# Build the kernel ELF
./build.sh

# Build and boot in QEMU (curses terminal display)
./build.sh run

# Clean build artifacts
./build.sh clean
```

---

## Verification

```bash
# Verify LLVM IR is valid
llvm-as dist/kernel.ll -o /dev/null
# Expected: (no output = valid)

# Verify zero unsupported constructs
grep '; UNSUPPORTED' dist/kernel.ll
# Expected: (no output = all constructs supported)

# Inspect the ELF binary
file dist/kernel.elf
# Expected: ELF 64-bit LSB executable, x86-64, ...

# Check the binary size
wc -c dist/kernel.elf
# Expected: < 50KB (this is the entire kernel)
```

---

## The Build Pipeline (Detailed)

```
kernel.ohn
    │
    │  node (Ohnrscript LLVM generator)
    │  parser.ohn → parse → AST
    │  generator-llvm.ohn → walk AST → emit LLVM IR
    ▼
kernel.ll  ← LLVM IR text file
    │
    │  llvm-as (validation only)
    ▼
   PASS ✓
    │
    │  clang -target x86_64-elf -ffreestanding -O2
    ▼
kernel.o   ← x86-64 ELF object file
    │
    │  (simultaneously)
boot.c
    │  clang -target x86_64-elf -ffreestanding -O2
    ▼
boot.o     ← multiboot2 header + stack setup + call kernelMain

kernel.o + boot.o
    │  clang -nostdlib -T linker.ld
    ▼
kernel.elf ← bootable ELF at 0x100000
    │
    │  qemu-system-x86_64 -kernel kernel.elf
    ▼
GRUB multiboot2 → loads ELF → jumps to _start (boot.o)
    → sets up stack → calls kernelMain (kernel.o, from kernel.ohn)
    → ring 0 execution → VGA hardware I/O → checksum → halt
```

---

## The Path to Maturity (Completed)

When v0.1 of this kernel was first built, it served strictly as a proof-of-concept. At the time, the Ohnrscript LLVM generator could not yet process loops or external bindings. 

Since then, the LLVM generator has reached production maturity, successfully implementing the following critical features:

| Feature | Unlocked Capability | Ecosystem Impact |
|---|---|---|
| `break`/`continue` | Loop-based interrupt polling | Unlocked `workers.ohn` event loops |
| FFI external calls | PIC/APIC setup & C-bindings | Unlocked `tls.ohn` via `mbedtls` |
| `obj.prop` access | Struct-like hardware registers | Unlocked massive socket state in `node.ohn` |

It was the successful completion of these compiler features that allowed Ohnrscript to expand from a simple Ring 0 VGA-buffer kernel into the comprehensive **sovereign computing stack** seen in the root ecosystem today.

---

## Historical Context

On August 25, 1991, Linus Torvalds posted:
> *"I'm doing a (free) operating system (just a hobby, won't be big and professional like gnu)"*

What he released was a kernel — not a full OS. It booted, managed hardware, ran programs. That was enough.

Ohnrscript Kernel v0.1 is the same category of moment for JavaScript-native systems programming: proof that the compilation path works, that JavaScript syntax can produce ring-0 native machine code, and that an operating system written in JavaScript syntax — compiled without a JavaScript engine — is not a theoretical possibility but a demonstrated fact.
