const { allocateScope, freeScope, insertSymbol, lookupSymbol, fnv1a } = require('../src/core/arena.ohn');

console.log("=== DOD Arena SymbolTable Benchmark ===");
console.log("Setting up 100,000 variable test...");

// 1. Create Source Buffer
// E.g., "var_0 var_1 var_2 ... var_99999"
const sourceString = Array.from({length: 100000}, (_, i) => "var_" + i).join(" ");
const sourceBuffer = Buffer.from(sourceString, 'utf8');

// Parse out the offsets and lengths of each token to avoid allocations during testing
const tokens = [];
let cursor = 0;
while (cursor < sourceBuffer.length) {
    const start = cursor;
    while (cursor < sourceBuffer.length && sourceBuffer[cursor] !== 32) { // 32 is space
        cursor++;
    }
    tokens.push({ offset: start, length: cursor - start });
    cursor++; // skip space
}

const numTokens = tokens.length; // Should be 100,000
console.log(`Parsed ${numTokens} symbols.`);

const arena = allocateScope(null);

// 2. Insert 100,000 symbols
console.log("Inserting symbols...");
for (let i = 0; i < numTokens; i++) {
    const t = tokens[i];
    // symbolFlags = i, nodeRef = i * 2
    insertSymbol(arena, sourceBuffer, t.offset, t.length, i, i * 2);
}

console.log(`Insertion complete. Occupied: ${arena.occupied_count}, String Cursor: ${arena.string_cursor} bytes`);

// 3. Warmup JIT (20,000 lookups)
console.log("Warming up V8 TurboFan (20,000 lookups)...");
for (let i = 0; i < 20000; i++) {
    const t = tokens[i];
    const hash = fnv1a(sourceBuffer, t.offset, t.length);
    lookupSymbol(arena, sourceBuffer, t.offset, t.length, hash);
}

// 4. Expose GC and take baseline
if (typeof global.gc !== 'function') {
    console.error("Error: You must run this script with `node --expose-gc`");
    process.exit(1);
}

global.gc();
const baselineHeap = process.memoryUsage().heapUsed;
console.log(`Baseline Heap: ${baselineHeap} bytes`);

// 5. Run Benchmark
console.log("Running 100,000 lookups...");
const start = process.hrtime.bigint();
let dummySum = 0;

for (let i = 0; i < numTokens; i++) {
    const t = tokens[i];
    // Precalculate hash directly in the loop as the lexer would
    const hash = fnv1a(sourceBuffer, t.offset, t.length);
    const nodeRef = lookupSymbol(arena, sourceBuffer, t.offset, t.length, hash);
    dummySum ^= nodeRef; // Defeat dead code elimination
}

const end = process.hrtime.bigint();

// 6. Final Measurement
const finalHeap = process.memoryUsage().heapUsed;
const heapDelta = finalHeap - baselineHeap;
const timeMs = Number(end - start) / 1000000;

console.log("=======================================");
console.log(`Dummy Sum: ${dummySum}`);
console.log(`Time: ${timeMs.toFixed(2)} ms`);
console.log(`Heap Delta: ${heapDelta} bytes`);
console.log("=======================================");

// If it's effectively zero (less than a few KB of internal ambient noise), it passes
if (heapDelta < 1024 * 50) { // allow 50KB ambient Node.js noise
    console.log("✅ Zero-allocation mathematical proof passed.");
} else {
    console.log("❌ Benchmark failed zero-allocation constraints.");
}

// 7. Test Free List
console.log("\nTesting Free List Recyclability...");
freeScope(arena);
const newArena = allocateScope(null);
console.log(`New arena from Free List? ${arena === newArena} (Expect true)`);
console.log(`New arena occupied: ${newArena.occupied_count} (Expect 0)`);
console.log(`New arena string cursor: ${newArena.string_cursor} (Expect 1)`);
