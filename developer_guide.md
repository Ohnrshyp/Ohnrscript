# Ohnrscript Developer Guide

Ohnrscript (`.ohn`) looks like JavaScript, but it does not execute like JavaScript. It is a strictly typed, ahead-of-time (AOT) compiled language that bypasses dynamic runtimes (V8/Node) to execute on bare metal via LLVM IR.

If you try to write standard web JavaScript, the compiler will fail. This guide explains the strict Data-Oriented Design (DOD) constraints you must follow.

---

## 1. The Core Rule: Everything is `i32`

Ohnrscript eliminates the dynamic heap. There are no Objects (`{}`), no dynamic Strings (`"hello"`), and no Arrays (`[]`). The foundational primitive of the language is the 32-bit integer (`i32`).

### Variables and Casting
All variables map directly to LLVM `i32` virtual registers. To guarantee type stability, you must cast your variables using the bitwise OR `| 0` operator.

```javascript
// Correct: Maps to a static i32 allocation
let counter = 0;
let max_connections = 1000 | 0;

// Incorrect: Will fail compilation
let data = {};
let name = "System"; // Strings do not exist (see Memory Mapping)
```

## 2. Memory Management (The DOD Arena)

Because there is no Garbage Collector (GC), you cannot allocate memory dynamically inside the hot path. All memory is managed manually via contiguous TypedArray arenas allocated ahead of time.

### Reading and Writing Memory
Instead of object properties, you read and write raw bytes via index offsets.

```javascript
// Correct: Reading a 32-bit integer (Little Endian) from a raw buffer
function readUint32_LE(buffer, byteOffset) {
    let wordIndex = byteOffset >>> 2;
    let bitShift = (byteOffset & 3) * 8;
    let b0 = (buffer[wordIndex] >>> bitShift) & 0xFF;
    let b1 = (buffer[wordIndex] >>> (bitShift + 8)) & 0xFF;
    // ... bitwise shift and reconstruct ...
    return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
}
```

### Pointer Arithmetic
Pointers in Ohnrscript are just integers (`i32`) that represent the byte offset into your arena.

```javascript
let start_offset = 12 | 0;
let next_header = (start_offset + 4) | 0; // Move pointer forward 4 bytes
```

## 3. String & Protocol Parsing

You cannot use `.split()`, `.match()`, or regex. Protocols (like HTTP or TCP) are parsed by casting byte sequences directly into integers.

```javascript
// Parsing the HTTP "GET " method via integer casting
// "GET " = 0x20544547 (Little Endian)
let METHOD_GET = 542393671;

function parse_method(buf_ptr) {
    let method_int = readUint32_LE(buf_ptr, 0) | 0;
    if (method_int === METHOD_GET) {
        return 1; // It's a GET request
    }
    return 0;
}
```

## 4. Floating Point Math (26+6 Fixed Point)

Ohnrscript bypasses hardware Floating-Point Units (FPUs) to guarantee deterministic execution across all CPU architectures. You cannot use `0.5` or `Math.PI`. 

Instead, Ohnrscript uses a custom 26+6 bit-packed fixed-point engine. Every `i32` holds 26 bits of whole numbers and 6 bits of fractional scale.

```javascript
// A standard Float32Array operation mapped to the 26+6 engine
function dotProduct(vecA, vecB, length) {
    let sum = 0 | 0;
    let i = 0 | 0;
    while (i < length) {
        // Math is executed purely via bit-shifting, bypassing the hardware FPU
        let a = vecA[i] | 0;
        let b = vecB[i] | 0;
        sum = (sum + multiply_fixed(a, b)) | 0;
        i = (i + 1) | 0;
    }
    return sum;
}
```

## 5. FFI (Foreign Function Interface)

To interact with C libraries, assembly, or the kernel hardware (like VirtIO or the VGA buffer), Ohnrscript provides the `__extern()` directive.

```javascript
// Bind to a C/LLVM function during linking
const router_handle = __extern('router_handle');

// Calling the external function
let response_ptr = router_handle(route_hash, request_ptr);
```

## 6. Loops and Branching

The LLVM generator fully supports `while` loops, `if/else` branching, `break`, and `continue`. However, loop condition variables must be strict integers.

```javascript
let i = 0 | 0;
while (i < 100) {
    if (buffer[i] === 13) { // Found '\r'
        break;
    }
    i = (i + 1) | 0;
}
```

## Summary Checklist for Ohnrscript Compilation
1. **No GC / Objects:** Remove all `{}` and `new Object()`
2. **No Dynamic Strings:** Replace string manipulation with byte-level ASCII checks.
3. **No Floats:** Convert all math to integer bit-shifts (26+6 scale).
4. **Cast Everything:** Use `| 0` to enforce `i32` register mapping.
5. **Pre-allocate:** Allocate your TypedArrays once at boot, never in the hot path.
