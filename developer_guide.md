# Ohnrscript Developer Guide & Language Reference

> **Version:** 0.1.0 · **License:** [BUSL 1.1](LICENSE.md)  
> Ohnrscript (`.ohn`) shares JavaScript's C-style syntax, but it is a fundamentally different language.  
> It is an ahead-of-time (AOT) compiled systems language that compiles to LLVM IR and native machine code.

---

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [The VS Code Extension](#2-the-vs-code-extension)
3. [Types & Values](#3-types--values)
4. [Variables & Constants](#4-variables--constants)
5. [Typed Arrays & Memory](#5-typed-arrays--memory)
6. [Functions](#6-functions)
7. [Control Flow](#7-control-flow)
8. [Operators](#8-operators)
9. [String & Protocol Parsing](#9-string--protocol-parsing)
10. [Classes & Methods](#10-classes--methods)
11. [Modules & Imports](#11-modules--imports)
12. [FFI — Foreign Function Interface](#12-ffi--foreign-function-interface)
13. [Fixed-Point Math (26+6)](#13-fixed-point-math-266)
14. [Decorators (V8 Target)](#14-decorators-v8-target)
15. [Compilation Targets](#15-compilation-targets)
16. [What Ohnrscript Does NOT Support](#16-what-ohnrscript-does-not-support)

---

## 1. Overview & Philosophy

Ohnrscript is a **strictly typed, AOT-compiled systems language** that uses JavaScript class syntax. It compiles through two backends:

| Backend | Pipeline | Output |
|---|---|---|
| **LLVM (Native)** | `.ohn` → Self-Hosted Parser → LLVM IR Generator → `clang -O3` → native binary | ARM64 / x86-64 ELF/Mach-O |
| **V8 (Node.js)** | `.ohn` → Self-Hosted Parser → JS Generator → Node.js | JavaScript (runs on V8) |

**Core design principles:**

- **Everything is `i32`.** The foundational primitive is the 32-bit signed integer. There is no dynamic heap, no garbage collector, and no runtime type system. All variables map directly to LLVM `i32` virtual registers.
- **Data-Oriented Design (DOD).** All data is stored in contiguous `TypedArray` arenas — flat buffers of integers. There are no JavaScript Objects, no prototype chains, and no property lookups.
- **Zero allocation.** Memory is pre-allocated at startup. No dynamic allocation occurs inside hot paths. This eliminates GC pauses entirely.
- **Dual compilation.** The same `.ohn` file can compile to both native machine code (via LLVM) and V8-optimized JavaScript. The language's design guarantees that V8's Turbofan JIT will treat all values as SMIs (Small Integers), preventing deoptimization.
- **Self-hosted.** The Ohnrscript compiler is written in Ohnrscript. The lexer, parser, AST arena, code emitter, and both code generators are all `.ohn` files that compile themselves through a verified 3-stage bootstrap.

---

## 2. The VS Code Extension

Because Ohnrscript enforces a strict subset of JavaScript syntax, you should install the official VS Code extension for proper `.ohn` syntax highlighting and language support:

```bash
cd .vscode-extension
code --install-extension ohnrscript-language-support-0.1.0.vsix
```

---

## 3. Types & Values

### The `i32` Type

Every value in Ohnrscript is a 32-bit signed integer. There is no `float`, no `string`, no `object`, and no `undefined` type at the hardware level.

```ohnrscript
let counter = 0;
let max_size = 4096;
let flags = 0xFF;
```

### Integer Literals

| Format | Example | Notes |
|---|---|---|
| Decimal | `42`, `1000`, `-1` | Standard base-10 |
| Hexadecimal | `0xFF`, `0x1F7`, `0x80` | Prefix `0x` — used extensively for byte constants, port addresses, and bitmasks |

### Boolean Values

Booleans are integers. `true` compiles to `1`, `false` compiles to `0`.

```ohnrscript
let is_ready = true;   // → i32: 1
let is_error = false;  // → i32: 0

if (is_ready) {
    // executes — any non-zero value is truthy
}
```

### Null and Undefined

`null` and `undefined` are both valid tokens but compile to `i32: 0` (zero). They exist for syntactic compatibility with JavaScript.

```ohnrscript
let ptr = null;       // → i32: 0
let empty = undefined; // → i32: 0
```

### The `| 0` Casting Convention

The bitwise OR zero pattern `| 0` is the canonical Ohnrscript idiom for enforcing integer semantics. On the V8 backend, it forces V8 to treat the value as a SMI (preventing HeapNumber promotion). On the LLVM backend, all values are already `i32`, so `| 0` is a no-op that the optimizer eliminates.

```ohnrscript
// Arithmetic results should use | 0 to guarantee i32 semantics
let sum = (a + b) | 0;
let product = (x * y) | 0;

// Loop counters and indices
let i = 0;
i = (i + 1) | 0;
```

**When is `| 0` required?**

| Context | Required? | Reason |
|---|---|---|
| Arithmetic results | Recommended | Prevents V8 deoptimization on the V8 backend |
| Literal assignments (`let x = 5`) | Not required | Literals are already integers |
| Constants (`const SIZE = 4096`) | Not required | Constants are inlined |
| Function return values | Recommended | Documents the return type |
| Array index operations | Recommended | Ensures index is SMI-safe |

---

## 4. Variables & Constants

Ohnrscript supports three declaration keywords: `const`, `let`, and `var`.

```ohnrscript
const MAX_CONNECTIONS = 1024;   // Immutable binding
let counter = 0;                // Mutable binding (block-scoped)
var legacy = 0;                 // Mutable binding (function-scoped)
```

### Behavior

| Keyword | Scope | Reassignable | LLVM IR |
|---|---|---|---|
| `const` | Block | No | `alloca i32` (optimizer inlines the constant) |
| `let` | Block | Yes | `alloca i32` + `store`/`load` |
| `var` | Function | Yes | `alloca i32` + `store`/`load` |

### Module-Level (Top-Level) Variables

Variables declared at the top level of a `.ohn` file are emitted as LLVM globals:

```ohnrscript
// Top-level: emits '@POOL_SIZE = global i32 65536'
const POOL_SIZE = 65536;
let poolOffset = 65536;
```

These are accessible by all functions in the module and are initialized via a lazy getter pattern.

---

## 5. Typed Arrays & Memory

Because there is no Garbage Collector (GC), you cannot allocate memory dynamically inside the hot path. All memory is managed manually via contiguous **TypedArray arenas** that are allocated ahead of time.

### Allocation

```ohnrscript
// Allocate a 4096-element Int32Array (16KB)
let buffer = new Int32Array(4096);

// Allocate a raw byte buffer
let raw = new Uint8Array(1024);

// Allocate a float buffer (for vectors, audio, etc.)
let vectors = new Float32Array(512);
```

On the LLVM backend, `new Int32Array(n)` and `new Float32Array(n)` call the runtime allocator `@ohn_alloc_f32`, which returns an offset into the linear heap.

### Reading and Writing

Array access uses standard bracket notation. Every element is 4 bytes (i32).

```ohnrscript
// Write a value at index 0
buffer[0] = 42;

// Read a value from index 5
let val = buffer[5] | 0;

// Computed index access
let i = 10;
let element = buffer[i] | 0;
```

### Complex Reads (Little-Endian)

To read larger primitives (like a 32-bit integer) from a raw buffer, you must combine bit-shifts. This maps perfectly to network and protocol parsing.

```ohnrscript
function readUint32_LE(buffer, byteOffset) {
    let b0 = buffer[byteOffset] | 0;
    let b1 = buffer[(byteOffset + 1) | 0] | 0;
    let b2 = buffer[(byteOffset + 2) | 0] | 0;
    let b3 = buffer[(byteOffset + 3) | 0] | 0;
    return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
}
```

---

## 6. Functions

Functions are declared using the `function` keyword. All parameters are implicitly `i32` on the V8 backend and `i64` (for unified pointer/integer ABI) on the LLVM backend.

### Declaration

```ohnrscript
function add(a, b) {
    return (a + b) | 0;
}

function processBuffer(buffer, length) {
    let sum = 0;
    let i = 0;
    while (i < length) {
        sum = (sum + buffer[i]) | 0;
        i = (i + 1) | 0;
    }
    return sum;
}
```

### Return Values

All functions return `i32`. If a function has no explicit `return` statement, it implicitly returns `0`.

```ohnrscript
function doWork() {
    // ... processing ...
    // Implicit return 0
}
```

### Exported Functions

Use `export function` to make a function visible to other modules (LLVM target):

```ohnrscript
export function handlePacket(buffer, length) {
    // This function can be called from other .ohn modules
    return 1;
}
```

### Scope

Functions have their own scope. Local variables are hoisted to the entry block as LLVM `alloca` instructions (required by LLVM's `mem2reg` optimization pass). Nested function declarations create separate scopes.

---

## 7. Control Flow

### `if` / `else`

```ohnrscript
if (status === 1) {
    // then branch
} else {
    // else branch
}
```

Conditions evaluate as integers — any non-zero value is truthy.

### `while` Loop

```ohnrscript
let i = 0;
while (i < length) {
    buffer[i] = 0;
    i = (i + 1) | 0;
}
```

### `for` Loop

```ohnrscript
for (let i = 0; i < length; i++) {
    buffer[i] = 0;
}
```

The `for` loop supports the standard init/test/update structure. On the LLVM backend, it generates dedicated `for.N`, `forbody.N`, `forupdate.N`, and `forexit.N` basic blocks.

### `break` and `continue`

Both are fully supported inside `while` and `for` loops:

```ohnrscript
let i = 0;
while (i < length) {
    if (buffer[i] === 0) {
        break;      // Exit the loop
    }
    if (buffer[i] === 255) {
        i = (i + 1) | 0;
        continue;   // Skip to next iteration
    }
    i = (i + 1) | 0;
}
```

### Ternary Operator (`? :`)

```ohnrscript
let result = (x > 0) ? x : 0;
```

> **Note:** The ternary operator is parsed as a `ConditionalExpression` node. On the LLVM backend, it is not yet fully wired — use `if/else` assignment as an alternative for native compilation.

### `throw`

```ohnrscript
if (length < 0) {
    throw new Error("Invalid length");
}
```

`throw` is supported for the V8 backend. On the LLVM backend, it is typically used for compile-time assertions rather than runtime error handling (there is no exception unwinding in bare-metal native binaries).

---

## 8. Operators

### Arithmetic

| Operator | Description | Example | LLVM IR |
|---|---|---|---|
| `+` | Addition | `(a + b) \| 0` | `add i32` |
| `-` | Subtraction | `(a - b) \| 0` | `sub i32` |
| `*` | Multiplication | `(a * b) \| 0` | `mul i32` |
| `/` | Division (signed) | `(a / b) \| 0` | `sdiv i32` |
| `%` | Modulo (signed) | `(a % b) \| 0` | `srem i32` |

### Bitwise

| Operator | Description | Example | LLVM IR |
|---|---|---|---|
| `\|` | Bitwise OR | `a \| b` | `or i32` |
| `&` | Bitwise AND | `a & 0xFF` | `and i32` |
| `^` | Bitwise XOR | `a ^ b` | `xor i32` |
| `<<` | Left shift | `a << 8` | `shl i32` |
| `>>` | Arithmetic right shift | `a >> 4` | `ashr i32` |
| `>>>` | Logical right shift | `a >>> 0` | `lshr i32` |

### Comparison

| Operator | Description | LLVM IR |
|---|---|---|
| `===` | Strict equality | `icmp eq i32` |
| `!==` | Strict inequality | `icmp ne i32` |
| `<` | Less than | `icmp slt i32` |
| `>` | Greater than | `icmp sgt i32` |
| `<=` | Less than or equal | `icmp sle i32` |
| `>=` | Greater than or equal | `icmp sge i32` |

> **Important:** Ohnrscript only supports strict equality (`===` / `!==`). Loose equality (`==` / `!=`) is **not supported** and will not compile. This is intentional — in an `i32`-only type system, there is no type coercion.

### Logical

| Operator | Description | LLVM IR |
|---|---|---|
| `&&` | Logical AND | `and i32` (bitwise on i32 values) |
| `\|\|` | Logical OR | `or i32` (bitwise on i32 values) |
| `!` | Logical NOT | `sub i32 0, %val` (negation) |

### Assignment

| Operator | Equivalent |
|---|---|
| `=` | Direct assignment |
| `+=` | `x = (x + y) \| 0` |
| `-=` | `x = (x - y) \| 0` |
| `*=` | `x = (x * y) \| 0` |
| `/=` | `x = (x / y) \| 0` |
| `%=` | `x = (x % y) \| 0` |
| `\|=` | `x = x \| y` |
| `&=` | `x = x & y` |
| `^=` | `x = x ^ y` |

### Update

| Operator | Description |
|---|---|
| `++` | Increment by 1 |
| `--` | Decrement by 1 |

### Unary

| Operator | Description | LLVM IR |
|---|---|---|
| `-x` | Negation | `sub i32 0, %x` |
| `+x` | Unary plus (no-op) | `add i32 0, %x` |

---

## 9. String & Protocol Parsing

Ohnrscript does not support dynamic strings. You cannot use `.split()`, `.match()`, or regex.

To parse text-based protocols (like HTTP or TCP), you must cast byte sequences directly into integers and compare them.

### Integer-Cast Method Constants

```ohnrscript
// Integer-Cast Method Constants (Little Endian)
// "GET " → bytes [0x47, 0x45, 0x54, 0x20] → LE i32: 0x20544547
const METHOD_GET  = 0x20544547 | 0;   // 542393671
const METHOD_POST = 0x54534F50 | 0;   // 1414745936

function parseHttpMethod(buffer) {
    let method_int = readUint32_LE(buffer, 0) | 0;

    if (method_int === METHOD_GET) {
        return 1; // GET
    }
    if (method_int === METHOD_POST) {
        return 2; // POST
    }
    return 0; // Unknown
}
```

### Scanning for Delimiters

```ohnrscript
function scanForNewline(buffer, length) {
    let i = 0;
    while (i < length) {
        let charCode = buffer[i] | 0;

        // 13 = '\r', 10 = '\n'
        if (charCode === 10) {
            return i;
        }

        i = (i + 1) | 0;
    }
    return -1;
}
```

**This is the Ohnrscript pattern.** Instead of `request.method === "GET"` (which requires string allocation, comparison, and GC), you cast 4 bytes into a single integer and compare it in one CPU instruction.

---

## 10. Classes & Methods

Ohnrscript supports `class` declarations with constructors and methods. On the V8 backend, classes work with the `@cbor` and `@binaryLayout` decorators to generate zero-allocation data structures. The LLVM backend parses class syntax but does not generate native code for classes — on the native target, you use `TypedArray` arenas and flat functions instead.

### Declaration

```ohnrscript
class PacketHeader {
    constructor(version, flags, length) {
        this.version = version;
        this.flags = flags;
        this.length = length;
    }

    isValid() {
        return this.version === 1;
    }
}
```

### `this` Keyword

`this` refers to the current class instance. It is supported in the parser and V8 generator.

---

## 11. Modules & Imports

### CommonJS (`require` / `module.exports`)

Ohnrscript uses the CommonJS module system for the V8 backend:

```ohnrscript
// Importing a module
const parser = require('./parser.ohn');

// Exporting from a module
module.exports = { parseFrame, scanBuffer };
```

On the LLVM backend, `require()` calls are compiled to **lazy getter function calls**. The generator creates a `@__get_module_exports_<module>()` function that is called once and cached:

```
; require('./parser.ohn') becomes:
%t0 = call ptr @__get_module_exports_parser()
```

### `export function` (LLVM Target)

For the LLVM backend, use `export function` to mark functions as externally visible:

```ohnrscript
export function handleTcpPacket(buffer, length) {
    // Visible to other .ohn modules and the linker
    return 0;
}
```

### How `module.exports` Works on LLVM

`module.exports = { ... }` assignments are **skipped** by the LLVM generator — they are a runtime concept. The lazy getter pattern handles inter-module access instead.

---

## 12. FFI — Foreign Function Interface

The `__extern()` directive binds an Ohnrscript identifier to an external C function symbol. This is how Ohnrscript talks to hardware, C libraries, assembly routines, and other `.ohn` modules at the native level.

### Syntax

```ohnrscript
// Bind to an external C function
const ohn_inb = __extern('inb');
const ohn_outb = __extern('outb');

// Call like a regular function
let status = ohn_inb(0x1F7) | 0;
ohn_outb(0x3F6, 0x02);
```

### How It Works

1. `__extern('name')` registers the C function name in the compiler's extern map
2. The LLVM generator emits a `declare i64 @name(...)` at the end of the module
3. At link time, `clang` resolves the symbol against the C runtime shim or other object files

### Parameter Passing

All FFI parameters are passed as `i32` values. The return value is `i64` on the C side and truncated to `i32` on the Ohnrscript side. This allows passing both integer values and memory addresses.

### Strict Arity Checking

The compiler enforces that every call to an `__extern` function uses the same number of arguments. Mismatched call sites produce a compile-time error:

```
[Ohnrscript] Compiler Error: FFI function called with conflicting argument counts
```

### Common Uses

```ohnrscript
// Hardware I/O (ohn-kernel)
const inb = __extern('inb');
const outb = __extern('outb');

// Cross-module function calls
const router_handle = __extern('router_handle');
let response = router_handle(method, route_hash, tx_buffer) | 0;

// C standard library
const memcpy = __extern('memcpy');
```

---

## 13. Fixed-Point Math (26+6)

Ohnrscript intentionally bypasses hardware Floating-Point Units (FPUs) for the LLVM/kernel target. This guarantees **100% deterministic execution** across all CPU architectures — no micro-rounding differences between ARM and x86.

You cannot use `0.5` or `Math.PI`.

### The 26+6 Encoding

Every `i32` can be interpreted as a fixed-point number with:
- **26 bits** for the integer part (range: roughly ±33 million)
- **6 bits** for the fractional part (precision: 1/64 ≈ 0.015625)

### `pack(value, scale)`

Converts an integer value into fixed-point representation:

```ohnrscript
function pack(value, scale) {
    return (value * scale) | 0;
}

// Pack the value 3 with a scale of 64 (2^6)
let three_fp = pack(3, 64);  // → 192
```

### `multiply(a, b)`

Multiplies two fixed-point values and shifts the result back:

```ohnrscript
function multiply(a, b) {
    // Shift right by 6 bits after multiplication
    // to remove the doubled fractional scale
    return ((a * b) >> 6) | 0;
}
```

### Example: Dot Product in Fixed-Point

```ohnrscript
function dotProduct(vecA, vecB, length) {
    let sum = 0;
    let i = 0;
    while (i < length) {
        let a = vecA[i] | 0;
        let b = vecB[i] | 0;
        sum = (sum + multiply(a, b)) | 0;
        i = (i + 1) | 0;
    }
    return sum;
}
```

---

## 14. Decorators (V8 Target)

Ohnrscript's V8 backend supports two class decorators that perform AOT (ahead-of-time) code generation via Babel transforms. These are compile-time features — they inject optimized methods into your class and are fully stripped from the output.

### `@cbor` — AOT CBOR Serialization

The `@cbor` decorator transforms a class into a zero-allocation CBOR binary serializer/deserializer. The compiler analyzes your field types at build time and injects `toCBOR()` and `fromCBOR()` methods that write/read raw bytes directly — bypassing JSON parsing and reflection entirely.

```ohnrscript
@cbor
class ServerStatus {
    isOnline: boolean;
    activeConnections: number;
    uptimeSeconds: number;
}

// Usage (after compilation):
const status = new ServerStatus();
status.isOnline = true;
status.activeConnections = 42;
status.uptimeSeconds = 86400;

const buf = status.toCBOR();             // → Uint8Array (CBOR binary)
const decoded = ServerStatus.fromCBOR(buf); // → ServerStatus instance
```

**Supported field types:**

| Type | CBOR Major Type | Notes |
|---|---|---|
| `number` | Major type 0/1 (unsigned/negative int) | 32-bit integers |
| `boolean` | Major type 7 (simple value) | `true` / `false` |
| `string` | Major type 3 (text string) | UTF-8 encoded, length-prefixed |
| `Array<number>` | Major type 4 (array) | Array of 32-bit integers |

**Compile command:**
```bash
npx ohnc my-schema.ohn
```

### `@binaryLayout` — Zero-Allocation Memory-Mapped Structs

The `@binaryLayout` decorator creates a typed view over a raw `ArrayBuffer`. It generates getters/setters that read and write fields at fixed byte offsets — zero memory allocation, zero copying.

```ohnrscript
@binaryLayout
class AudioMLBatch {
    @type('uint8')
    @size(1)
    version;

    @type('uint8')
    @size(1)
    flags;

    @type('uint16')
    @size(1)
    batchId;

    @type('uint32')
    @size(1)
    timestamp;

    @type('float32')
    @size(512)
    embedding;

    @type('float32')
    @size(1024)
    pcmData;
}

// Usage:
const packet = AudioMLBatch.fromBuffer(networkBuffer);
processEmbedding(packet.embedding);
```

**Supported `@type` values:** `uint8`, `uint16`, `uint32`, `float32`

**`@size(n)` specifies the element count** — for scalar fields use `1`, for array fields use the number of elements.

---

## 15. Compilation Targets

### Self-Hosted Compiler (Recommended)

The self-hosted compiler uses Ohnrscript's own parser and generator, compiled through a verified 3-stage bootstrap:

```bash
# Compile to JavaScript (V8 target)
node compiler/scripts/compile.js my-file.ohn

# Compile to LLVM IR (native target)
node compiler/scripts/compile.js --target llvm my-file.ohn -o my-file.ll

# Compile LLVM IR to native binary
clang -O3 -march=native my-file.ll compiler/src/shim/ohnrscript-runtime.c -o my-file -lm
```

### V8/Babel CLI (`ohnc`)

The `ohnc` CLI uses Babel under the hood and supports the decorator system (`@cbor`, `@binaryLayout`):

```bash
npx ohnc my-file.ohn
# → produces my-file.js
node my-file.js
```

### Bootstrap (Self-Hosting Verification)

To verify the self-hosted compiler's integrity:

```bash
npm run bootstrap
```

This runs the **Tombstone Bootstrap Protocol**:
1. **Stage 0:** Babel compiles `.ohn` → `.js` (the "tombstone" compiler)
2. **Stage 1:** Stage 0 output compiles `.ohn` → `.js`
3. **Stage 2:** Stage 1 output compiles `.ohn` → `.js`
4. **Verification:** Stage 1 and Stage 2 outputs must be **byte-for-byte identical** (SHA-256 match)

### V8 vs LLVM Feature Comparison

| Feature | V8 Backend | LLVM Backend |
|---|---|---|
| Variables (`const`, `let`, `var`) | ✅ | ✅ |
| Functions | ✅ | ✅ |
| Control flow (`if`, `while`, `for`, `break`, `continue`) | ✅ | ✅ |
| All operators | ✅ | ✅ |
| Typed array access | ✅ | ✅ |
| `export function` | ✅ | ✅ |
| `require()` / `module.exports` | ✅ | ✅ (lazy getter) |
| `__extern()` FFI | ❌ | ✅ |
| `@cbor` decorator | ✅ | ❌ |
| `@binaryLayout` decorator | ✅ | ❌ |
| Classes with `this` | ✅ | Parser only |
| Non-computed member access (`obj.prop`) | ✅ | ❌ (UNSUPPORTED) |
| Ternary (`? :`) | ✅ | Parser only |

---

## 16. What Ohnrscript Does NOT Support

This is critical for JavaScript developers. If you instinctively reach for any of these patterns, here's what to do instead.

| ❌ Not Supported | ✅ Ohnrscript Alternative |
|---|---|
| `const obj = { name: "foo" }` — Dynamic objects | Use a `TypedArray` with fixed offsets |
| `"hello" + " world"` — String concatenation | Store strings as byte sequences in `Uint8Array` buffers |
| `/^GET/` — Regular expressions | Compare integer byte codes: `buffer[0] === 71` (G) |
| `obj.hasOwnProperty("key")` — Prototype chains | Not applicable — there are no objects |
| `async function` / `await` — Async/await | Use polling loops or event-driven I/O |
| `try { } catch (e) { }` — Exception handling | Use return codes: `if (result < 0) { /* error */ }` |
| `switch (x) { case 1: ... }` — Switch statements | Use `if/else if` chains |
| `const { a, b } = obj` — Destructuring | Assign each variable individually |
| `...args` — Spread operator | Pass arrays by pointer and length |
| `` `Hello ${name}` `` — Template literals | Build byte buffers manually |
| `0.5`, `3.14`, `Math.PI` — Floating-point | Use 26+6 fixed-point encoding (see Chapter 13) |
| `==` / `!=` — Loose equality | Use `===` / `!==` (strict only) |
| `arr.map()`, `arr.filter()` — Array methods | Write explicit `while`/`for` loops |
| `() => x` — Arrow functions | Use `function` declarations |
| `import x from 'y'` — ES modules | Use `require()` / `module.exports` |
| Closures (capturing outer variables) | Pass data explicitly as function parameters |
| `class extends Base` — Inheritance | Compose with flat data layouts |

---

## Summary Checklist for Valid Ohnrscript

When writing `.ohn` files, run through this mental checklist:

1. **No GC / Objects:** Remove all `{}` and `new Object()`. Use `TypedArray` arenas.
2. **No Dynamic Strings:** Replace string operations with byte-level ASCII integer comparisons.
3. **No Floats:** Convert all math to integer operations or 26+6 fixed-point.
4. **Cast Everything:** Use `| 0` to enforce `i32` register mapping.
5. **Pre-allocate:** Allocate your `TypedArray` buffers once at startup, never inside a hot loop.
6. **Think in Bytes:** Protocols, data structures, and payloads are all byte sequences at fixed offsets.
