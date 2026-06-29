const { v4: uuidv4 } = require('uuid');
const { generateUUIDv4 } = require('../src/ohn-uuid.js');

const ITERATIONS = 5_000_000;

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function runBenchmark() {
  console.log(`Running Benchmark: ${ITERATIONS} UUID generations...\n`);

  // --- Test 1: Standard UUID ---
  try {
    if (global.gc) global.gc();
  } catch (e) {
    console.error('You must run this script with --expose-gc');
    process.exit(1);
  }

  let startHeap = process.memoryUsage().heapUsed;
  let startTime = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    uuidv4();
  }

  let endTime = performance.now();
  let endHeap = process.memoryUsage().heapUsed;

  const standardTime = endTime - startTime;
  const standardHeapDelta = endHeap - startHeap;

  console.log('--- Standard Zod (uuid package) ---');
  console.log(`Time: ${standardTime.toFixed(2)} ms`);
  console.log(`Heap Delta: ${formatMB(standardHeapDelta)} MB\n`);

  // --- Test 2: Ohnrscript Zero-Allocation ---
  try {
    if (global.gc) global.gc();
  } catch (e) {}

  startHeap = process.memoryUsage().heapUsed;
  startTime = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    generateUUIDv4();
  }

  endTime = performance.now();
  endHeap = process.memoryUsage().heapUsed;

  const ohnrTime = endTime - startTime;
  const ohnrHeapDelta = endHeap - startHeap;

  console.log('--- Ohnrscript (Zero-Allocation) ---');
  console.log(`Time: ${ohnrTime.toFixed(2)} ms`);
  console.log(`Heap Delta: ${formatMB(ohnrHeapDelta)} MB\n`);
  
  console.log('--- Summary ---');
  console.log(`Speedup: ${(standardTime / ohnrTime).toFixed(2)}x faster`);
}

runBenchmark();
