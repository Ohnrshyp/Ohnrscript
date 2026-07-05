const fs = require('fs');

const JSON_FILE = './vectors.json';

console.log(`[JSON Benchmark] Reading ${JSON_FILE} into memory...`);
const text = fs.readFileSync(JSON_FILE, 'utf8');

console.log(`[JSON Benchmark] Running JSON.parse() on ${text.length} bytes of text...`);
const startHeap = process.memoryUsage().heapUsed;

const parsed = JSON.parse(text);

const endHeap = process.memoryUsage().heapUsed;

console.log(`✅ [JSON Benchmark] Success!`);
console.log(`[JSON Benchmark] V8 Heap Delta: ${((endHeap - startHeap) / 1024 / 1024).toFixed(2)} MB`);
