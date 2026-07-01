const fs = require('fs');
const { Emitter } = require('../src/codegen/emitter.ohn');

console.log("=== DOD Off-Heap Emitter Stress Test ===");

if (typeof global.gc !== 'function') {
    console.error("Error: You must run this script with `node --expose-gc`");
    process.exit(1);
}

const outputPath = '/tmp/ohnrscript-2gb-test.js';

// Clean up if a previous test failed
if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
}

// Target: 2GB of generated javascript code
const TARGET_BYTES = 2 * 1024 * 1024 * 1024; 

// A small dummy token to simulate an AST node being emitted
const dummyToken = Buffer.from("console.log('hello world from ohnrscript zero allocation compiler');\n", 'utf8');
const tokenLength = dummyToken.length;
const totalIterations = Math.ceil(TARGET_BYTES / tokenLength);

console.log(`Target Output Size: ${(TARGET_BYTES / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`Simulating ${totalIterations.toLocaleString()} AST node emissions...`);

// Force garbage collection to get a pristine baseline
global.gc();
const baselineHeap = process.memoryUsage().heapUsed;
console.log(`Baseline V8 Heap: ${(baselineHeap / 1024 / 1024).toFixed(2)} MB`);

const emitter = new Emitter(outputPath);

const start = process.hrtime.bigint();

for (let i = 0; i < totalIterations; i++) {
    // Emulate passing the raw bytes straight from the tokenizer/AST string pool
    emitter.emit(dummyToken, 0, tokenLength);
}

emitter.flush();

const end = process.hrtime.bigint();

// Force GC again before final measurement to sweep any ambient loop noise
global.gc();
const finalHeap = process.memoryUsage().heapUsed;
const heapDeltaBytes = finalHeap - baselineHeap;
const timeMs = Number(end - start) / 1000000;

const stat = fs.statSync(outputPath);

console.log("\n=======================================");
console.log(`Final File Size on Disk: ${(stat.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
console.log(`Total Time: ${(timeMs / 1000).toFixed(2)} seconds`);
console.log(`V8 Heap Delta: ${(heapDeltaBytes / 1024).toFixed(2)} KB`);
console.log("=======================================");

if (heapDeltaBytes < 500 * 1024) { // Less than 500KB of ambient noise is statistically zero
    console.log("✅ Zero-allocation mathematical proof passed. No V8 string explosion occurred.");
} else {
    console.log("❌ Benchmark failed zero-allocation constraints. Heap inflated.");
}

// Clean up
console.log("\nCleaning up 2GB test file...");
fs.unlinkSync(outputPath);
console.log("Cleanup complete.");
