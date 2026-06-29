const { v4: uuidv4 } = require('uuid');
const { generateUUIDv4Raw } = require('../src/ohn-uuid.js');

const ITERATIONS = 5_000_000;

function runBenchmark() {
  console.log(`Running Raw Benchmark (No String Formatting): ${ITERATIONS} UUID generations...\n`);

  // --- Test 1: Standard UUID (Raw 16 Bytes) ---
  try { if (global.gc) global.gc(); } catch (e) {}

  const standardBuf = new Uint8Array(16);
  let startTime = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    uuidv4(null, standardBuf);
  }

  let endTime = performance.now();
  const standardTime = endTime - startTime;

  console.log('--- Standard Zod (uuid package raw bytes) ---');
  console.log(`Time: ${standardTime.toFixed(2)} ms\n`);

  // --- Test 2: Ohnrscript Zero-Allocation (Raw 16 Bytes) ---
  try { if (global.gc) global.gc(); } catch (e) {}

  startTime = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    generateUUIDv4Raw();
  }

  endTime = performance.now();
  const ohnrTime = endTime - startTime;

  console.log('--- Ohnrscript (Zero-Allocation raw bytes) ---');
  console.log(`Time: ${ohnrTime.toFixed(2)} ms\n`);
  
  console.log('--- Summary ---');
  console.log(`Speedup: ${(standardTime / ohnrTime).toFixed(2)}x faster`);
}

runBenchmark();
