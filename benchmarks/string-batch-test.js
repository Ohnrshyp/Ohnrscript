const { v4: uuidv4 } = require('uuid');
const { generateUUIDv4Raw, pool, fillEntropy } = require('../examples/ohn-uuid.js');

const BATCH_SIZE = 4096;
const UUID_LEN = 36;
const giantBuffer = new Uint8Array(BATCH_SIZE * UUID_LEN);

// Static lookup table for ASCII hex characters (0-9, a-f)
const hexLookup = new Uint8Array([
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57, // 0-9
  97, 98, 99, 100, 101, 102               // a-f
]);

const HYPHEN = 0x2d;

let batchedStrings = [];
let batchIndex = BATCH_SIZE;

function getBatchedStringUUID() {
  if (batchIndex >= BATCH_SIZE) {
    // Generate 4096 UUID bytes into the giant buffer
    let outOffset = 0;
    for (let count = 0; count < BATCH_SIZE; count++) {
      const raw = generateUUIDv4Raw();
      
      let outIndex = outOffset;
      // Pre-fill hyphens
      giantBuffer[outIndex + 8] = HYPHEN;
      giantBuffer[outIndex + 13] = HYPHEN;
      giantBuffer[outIndex + 18] = HYPHEN;
      giantBuffer[outIndex + 23] = HYPHEN;

      for (let i = 0; i < 16; i++) {
        if (outIndex === outOffset + 8 || outIndex === outOffset + 13 || outIndex === outOffset + 18 || outIndex === outOffset + 23) {
          outIndex++;
        }
        const byte = raw[i];
        giantBuffer[outIndex++] = hexLookup[byte >> 4];
        giantBuffer[outIndex++] = hexLookup[byte & 0x0f];
      }
      outOffset += UUID_LEN;
    }

    batchIndex = 0;
  }
  
  const offset = batchIndex * UUID_LEN;
  batchIndex++;
  // Create a clean SeqOneByteString directly from the buffer slice
  return Buffer.from(giantBuffer.buffer, giantBuffer.byteOffset + offset, UUID_LEN).toString('utf8');
}

const ITERATIONS = 5_000_000;

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function runBenchmark() {
  console.log(`Running String Batch Benchmark: ${ITERATIONS} UUID generations...\n`);

  // --- Test 1: Standard Zod (uuid package) ---
  try { if (global.gc) global.gc(); } catch (e) {}

  let startHeap = process.memoryUsage().heapUsed;
  let startTime = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const s = uuidv4();
    // prevent compiler optimization
    if (s.length === 0) console.log("empty");
  }

  let endTime = performance.now();
  let endHeap = process.memoryUsage().heapUsed;

  const standardTime = endTime - startTime;
  const standardHeapDelta = endHeap - startHeap;

  console.log('--- Standard Zod (uuid package strings) ---');
  console.log(`Time: ${standardTime.toFixed(2)} ms`);
  console.log(`Heap Delta: ${formatMB(standardHeapDelta)} MB\n`);

  // --- Test 2: Ohnrscript Batched Strings ---
  try { if (global.gc) global.gc(); } catch (e) {}

  startHeap = process.memoryUsage().heapUsed;
  startTime = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const s = getBatchedStringUUID();
    // prevent compiler optimization
    if (s.length === 0) console.log("empty");
  }

  endTime = performance.now();
  endHeap = process.memoryUsage().heapUsed;

  const ohnrTime = endTime - startTime;
  const ohnrHeapDelta = endHeap - startHeap;

  console.log('--- Ohnrscript (Batched Sliced Strings) ---');
  console.log(`Time: ${ohnrTime.toFixed(2)} ms`);
  console.log(`Heap Delta: ${formatMB(ohnrHeapDelta)} MB\n`);
  
  console.log('--- Summary ---');
  console.log(`Speedup: ${(standardTime / ohnrTime).toFixed(2)}x faster`);
}

runBenchmark();
