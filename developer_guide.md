# Ohnrscript Developer Guide

Welcome to Ohnrscript (`.ohn`). While it shares the ergonomic C-style syntax of JavaScript, it is a fundamentally different language. Ohnrscript is an ahead-of-time (AOT) compiled systems language designed to bypass dynamic runtimes (V8/Node) and execute directly on bare metal via LLVM IR.

### The VS Code Extension
Because Ohnrscript enforces a strict subset of JavaScript syntax, you should install the official VS Code extension for proper `.ohn` syntax highlighting and language support:

```bash
cd .vscode-extension
code --install-extension ohnrscript-language-support-0.1.0.vsix
```

This guide covers the core constraints, syntax semantics, and Data-Oriented Design (DOD) principles required to write valid Ohnrscript.

---

## 1. The Core Philosophy: Everything is `i32`

Ohnrscript eliminates the dynamic heap. There are no Objects (`{}`), no dynamic Strings (`"hello"`), and no Arrays (`[]`). You cannot use `let obj = new Object()` because there is no Garbage Collector to clean it up.

The foundational primitive of the language is the 32-bit integer (`i32`).

### Variable Declarations & Casting
All variables map directly to LLVM `i32` virtual registers. To guarantee type stability, the compiler enforces explicit integer casting using the bitwise OR `| 0` operator.

```ohnrscript
// Correct: Maps to a static i32 register
let counter = 0 | 0;
let max_connections = 1000 | 0;

// Reassigning must maintain the cast
counter = (counter + 1) | 0;

// Constants do not require casting if assigned literal integers
const PAGE_SIZE = 4096;
```

If you attempt to write standard web JavaScript with dynamic strings or objects, the LLVM generator will throw a compilation error.

---

## 2. Memory Management (The DOD Arena)

Because there is no Garbage Collector (GC), you cannot allocate memory dynamically inside the hot path. All memory is managed manually via contiguous **TypedArray arenas** that are allocated ahead of time.

### Reading and Writing Memory
Instead of accessing object properties, you read and write raw bytes via index offsets. 

```ohnrscript
// Accessing memory via typed array indices
let buffer = new Uint8Array(4096);
let offset = 12 | 0;

// Read a byte
let b0 = buffer[offset] | 0;

// Write a byte
buffer[offset] = 255 | 0;
```

### Complex Reads (Little-Endian)
To read larger primitives (like a 32-bit integer) from a raw buffer, you must combine bit-shifts. This maps perfectly to network and protocol parsing.

```ohnrscript
function readUint32_LE(buffer, byteOffset) {
    let wordIndex = byteOffset >>> 2;
    let bitShift = (byteOffset & 3) * 8;
    
    let b0 = (buffer[wordIndex] >>> bitShift) & 0xFF;
    let b1 = (buffer[wordIndex] >>> (bitShift + 8)) & 0xFF;
    let b2 = (buffer[wordIndex] >>> (bitShift + 16)) & 0xFF;
    let b3 = (buffer[wordIndex] >>> (bitShift + 24)) & 0xFF;
    
    return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
}
```

---

## 3. String & Protocol Parsing

Ohnrscript does not support dynamic strings. You cannot use `.split()`, `.match()`, or regex. 

To parse text-based protocols (like HTTP or TCP), you must cast byte sequences directly into integers and compare them.

```ohnrscript
// Integer-Cast Method Constants (Little Endian)
// "GET " -> 0x20544547 (542393671)
let METHOD_GET = 542393671 | 0;

function parse_http_method(buf_ptr) {
    // Read the first 4 bytes of the request
    let method_int = readUint32_LE(buf_ptr, 0) | 0;
    
    if (method_int === METHOD_GET) {
        return 1; // It's a GET request
    }
    return 0; // Unknown method
}
```

---

## 4. Control Flow (Loops & Branching)

The LLVM generator fully supports standard control flow mechanisms, including `while` loops, `if/else` branching, `break`, and `continue`. 

However, all loop condition variables must be strict integers.

```ohnrscript
function scanForNewline(buffer, length) {
    let i = 0 | 0;
    while (i < length) {
        let charCode = buffer[i] | 0;
        
        // 13 = '\r', 10 = '\n'
        if (charCode === 10) {
            break; // Standard break is supported
        }
        
        i = (i + 1) | 0;
    }
    return i;
}
```

*(Note: `for` loops are currently transpiled internally to `while` loops by the parser. Use `while` loops explicitly for deterministic LLVM IR output).*

---

## 5. FFI (Foreign Function Interface)

To interact with C libraries, assembly, or the kernel hardware (like VirtIO drivers or the VGA buffer), Ohnrscript provides the `__extern()` directive. This links external symbols during the LLVM compilation phase.

```ohnrscript
// Bind to hardware I/O instructions (inb/outb)
const ohn_inb = __extern('inb');
const ohn_outb = __extern('outb');

// Read from a hardware port
let status = ohn_inb(0x1F7) | 0;

// Bind to another Ohnrscript module
const router_handle = __extern('router_handle');
let response_ptr = router_handle(route_hash, request_ptr);
```

---

## 6. Floating Point Math (26+6 Fixed Point)

Ohnrscript intentionally bypasses hardware Floating-Point Units (FPUs) to guarantee 100% deterministic execution across all CPU architectures (preventing micro-rounding differences between ARM and x86).

You cannot use `0.5` or `Math.PI`. 

Instead, Ohnrscript uses a custom **26+6 bit-packed fixed-point engine**. Every `i32` holds 26 bits of whole numbers and 6 bits of fractional scale.

```ohnrscript
// Multiplying two 26+6 fixed-point integers
function multiply_fixed(a, b) {
    // The exact implementation relies on bit-shifting the scale
    // out after the raw multiplication.
    return ((a * b) >> 6) | 0;
}

function computeDotProduct(vecA, vecB, length) {
    let sum = 0 | 0;
    let i = 0 | 0;
    while (i < length) {
        let a = vecA[i] | 0;
        let b = vecB[i] | 0;
        sum = (sum + multiply_fixed(a, b)) | 0;
        i = (i + 1) | 0;
    }
    return sum;
}
```

---

## Summary Checklist for Valid Ohnrscript

When writing `.ohn` files, run through this mental checklist:
1. **No GC / Objects:** Remove all `{}` and `new Object()`.
2. **No Dynamic Strings:** Replace string manipulation with byte-level ASCII integer checks.
3. **No Floats:** Convert all math to integer bit-shifts (26+6 scale).
4. **Cast Everything:** Use `| 0` to enforce `i32` register mapping.
5. **Pre-allocate:** Allocate your TypedArrays once at boot, never dynamically in a hot path loop.
