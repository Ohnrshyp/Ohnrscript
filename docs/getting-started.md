# Getting Started with Ohnrscript

> Complete this tutorial in under 15 minutes. You'll go from zero to running compiled Ohnrscript.

---

## Prerequisites

1. **Node.js ≥ 18** — [Download](https://nodejs.org)
2. **Clone the repo:**
   ```bash
   git clone https://github.com/ohnrshyp/ohnrscript.git
   cd ohnrscript
   npm install
   ```
3. **Install the VS Code extension** (optional but recommended):
   ```bash
   cd .vscode-extension
   code --install-extension ohnrscript-language-support-0.1.0.vsix
   cd ..
   ```
   This gives you syntax highlighting and language support for `.ohn` files.

---

## Step 1: Your First `.ohn` File

Create a file called `my-first.ohn`:

```ohnrscript
'use strict';

function add(a, b) {
    return (a + b) | 0;
}

const SCALE = 64;

function scale(value) {
    return (value * SCALE) | 0;
}

function main() {
    let result = add(10, 20) | 0;
    let scaled = scale(result) | 0;
    return scaled;
}

module.exports = { add, scale, main };
```

### Compile it

```bash
node compiler/scripts/compile.js my-first.ohn
```

This uses the **self-hosted Ohnrscript compiler** — a compiler written in Ohnrscript that compiles itself. It produces `my-first.js`.

### Run it

```bash
node -e "const m = require('./my-first.js'); console.log('Result:', m.main())"
```

Expected output:
```
Result: 1920
```

**What just happened:**
- `add(10, 20)` → `30`
- `scale(30)` → `30 * 64` → `1920`
- Every `| 0` enforces `i32` integer semantics
- `module.exports` makes functions available to the caller

---

## Step 2: Working with Buffers

In Ohnrscript, there are no dynamic objects or strings. All data lives in `TypedArray` buffers. Create `my-buffer.ohn`:

```ohnrscript
'use strict';

// Read a 16-bit value (big-endian) from a byte buffer
function readUint16_BE(buffer, offset) {
    let hi = buffer[offset] | 0;
    let lo = buffer[(offset + 1) | 0] | 0;
    return ((hi << 8) | lo) | 0;
}

// Write a 16-bit value (big-endian) to a byte buffer
function writeUint16_BE(buffer, offset, value) {
    buffer[offset] = (value >>> 8) & 0xFF;
    buffer[(offset + 1) | 0] = value & 0xFF;
}

module.exports = { readUint16_BE, writeUint16_BE };
```

Compile and test:

```bash
node compiler/scripts/compile.js my-buffer.ohn
node -e "
const m = require('./my-buffer.js');
const buf = new Uint8Array([0x01, 0xF4]);
console.log('Read:', m.readUint16_BE(buf, 0));
"
```

Expected output:
```
Read: 500
```

**Key concept:** `0x01F4` in big-endian is `500` in decimal. You reconstructed a 16-bit integer from two raw bytes using bit-shifts — no `DataView`, no dynamic allocation.

---

## Step 3: Parsing a Protocol

Real-world Ohnrscript shines at protocol parsing. Since there are no strings, you compare bytes as integers. Create `my-parser.ohn`:

```ohnrscript
'use strict';

// "GET " as a little-endian 32-bit integer: 0x20544547
const METHOD_GET = 0x20544547 | 0;

function readUint32_LE(buffer, offset) {
    let b0 = buffer[offset] | 0;
    let b1 = buffer[(offset + 1) | 0] | 0;
    let b2 = buffer[(offset + 2) | 0] | 0;
    let b3 = buffer[(offset + 3) | 0] | 0;
    return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
}

// Returns 1 if the buffer starts with "GET ", 0 otherwise
function isGetRequest(buffer) {
    let method = readUint32_LE(buffer, 0) | 0;
    if (method === METHOD_GET) {
        return 1;
    }
    return 0;
}

module.exports = { isGetRequest };
```

Compile and test:

```bash
node compiler/scripts/compile.js my-parser.ohn
node -e "
const m = require('./my-parser.js');
const get = Buffer.from('GET /index.html HTTP/1.1');
const post = Buffer.from('POST /api/data HTTP/1.1');
console.log('GET?', m.isGetRequest(get));
console.log('POST?', m.isGetRequest(post));
"
```

Expected output:
```
GET? 1
POST? 0
```

**This is the Ohnrscript pattern.** Instead of `request.method === "GET"` (which requires string allocation, comparison, and GC), you cast 4 bytes into a single integer and compare it in one CPU instruction.

---

## Step 4: Using a Package

Ohnrscript has a standard library of zero-allocation packages. Let's use `ohn-uuid`:

```bash
node -e "
const uuid = require('./packages/ohn-uuid/src/ohn-uuid.ohn');
const id = uuid.generateUUIDv4();
console.log('UUID:', Buffer.from(id).toString('utf8'));
"
```

The UUID is generated using a pre-allocated entropy pool (65KB) and a pre-allocated output buffer (36 bytes). No heap allocation occurs during generation.

Browse the full package API reference in `docs/api/` for all available packages.

---

## Step 5: Compile to Native (LLVM)

The same `.ohn` file can compile to a native binary via LLVM IR. This is what powers `ohn-kernel` — a 64KB HTTP-serving unikernel.

### Prerequisites for LLVM compilation

```bash
# macOS
brew install llvm
export PATH="$(brew --prefix llvm)/bin:$PATH"

# Verify
llc --version
```

### Compile to LLVM IR

Using the `hello-world.ohn` example:

```bash
node compiler/scripts/compile.js --target llvm examples/hello-world.ohn -o hello-world.ll
```

This produces `hello-world.ll` — human-readable LLVM IR.

### Compile to native binary

```bash
clang -O3 -march=native hello-world.ll compiler/src/shim/ohnrscript-runtime.c -o hello-world -lm
```

### Run it

```bash
./hello-world
```

**What happened:** The same Ohnrscript went through a completely different backend. Instead of producing JavaScript for V8, the self-hosted compiler generated LLVM IR, which `clang -O3` optimized into a native ARM64 or x86-64 binary. LLVM's optimizer auto-vectorizes loops using SIMD instructions (NEON on ARM, SSE/AVX on x86).

---

## Next Steps

| Resource | What You'll Learn |
|---|---|
| [Developer Guide & Language Reference](../developer_guide.md) | Complete syntax reference — all 16 chapters |
| [API Reference](api/) | Function signatures for every package |
| [Examples](../examples/) | 10 documented, educational `.ohn` files |
| [ohn-kernel README](../packages-llvm/ohn-kernel/README.md) | How the bare-metal HTTP kernel works |
| [Benchmark Results](../benchmarks/BENCHMARK_RESULTS.md) | Performance data vs V8, Bun, Go, Rust |

---

## Quick Reference

```bash
# Compile to JS (V8 target)
node compiler/scripts/compile.js my-file.ohn

# Compile to LLVM IR (native target)
node compiler/scripts/compile.js --target llvm my-file.ohn -o my-file.ll

# Compile LLVM IR to native binary
clang -O3 -march=native my-file.ll compiler/src/shim/ohnrscript-runtime.c -o my-file -lm

# Compile with V8/Babel CLI (supports @cbor, @binaryLayout)
npx ohnc my-file.ohn

# Run the self-hosting bootstrap verification
npm run bootstrap

# Run the test suite
npm test
```
