const { parseFrame } = require('../examples/ohn-ws');
const { performance } = require('perf_hooks');
const ws = require('ws'); 

const ITERATIONS = 2_000_000;
const payloadText = '{"event":"ping","data":{"timestamp":1719660000000,"id":"abcdef1234567890"}}';

function createMaskedFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  const frame = Buffer.alloc(2 + 4 + len);
  frame[0] = 0x81; 
  frame[1] = 0x80 | len; 
  const mask = Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]);
  mask.copy(frame, 2);
  for (let i = 0; i < len; i++) {
    frame[6 + i] = payload[i] ^ mask[i % 4];
  }
  return frame;
}

const originalFrame = createMaskedFrame(payloadText);

function forceGC() {
  try {
    if (global.gc) global.gc();
  } catch (e) {}
}

console.log(`Starting WebSocket Parser Benchmark`);
console.log(`Iterations: ${ITERATIONS.toLocaleString()}`);
console.log(`Payload length: ${payloadText.length} bytes`);
console.log("---");

// Test 1: Standard `ws` Receiver
forceGC();
const startHeapStandard = process.memoryUsage().heapUsed;
const startTimeStandard = performance.now();

// Instantiate a Writable receiver
const receiver = new ws.Receiver({ isServer: true, skipUTF8Validation: true });
receiver.on('message', (data) => {});

// We must use a small number of iterations if it queues, or we can just measure the unmask directly.
// Let's pre-allocate 1,000,000 frames so we don't measure Buffer creation during the loop.
const TEST_ITERATIONS = 500_000;
const framesForWs = new Array(TEST_ITERATIONS);
const framesForOhn = new Array(TEST_ITERATIONS);

for(let i=0; i<TEST_ITERATIONS; i++) {
  framesForWs[i] = createMaskedFrame(payloadText);
  framesForOhn[i] = createMaskedFrame(payloadText);
}

// Force GC after pre-allocation
forceGC();

console.log(`Pre-allocated ${TEST_ITERATIONS.toLocaleString()} frames. Testing...`);

const startHeapStandardReal = process.memoryUsage().heapUsed;
const startTimeStandardReal = performance.now();

for (let i = 0; i < TEST_ITERATIONS; i++) {
  // `receiver.write` is synchronous enough to parse if chunk is complete
  receiver.write(framesForWs[i]);
}

const endTimeStandard = performance.now();
const endHeapStandard = process.memoryUsage().heapUsed;
const timeStandard = endTimeStandard - startTimeStandardReal;
const heapDeltaStandard = (endHeapStandard - startHeapStandardReal) / 1024 / 1024;

console.log("Test 1: Standard `ws` package Receiver");
console.log(`Time: ${timeStandard.toFixed(2)} ms`);
console.log(`Heap Delta: ${heapDeltaStandard.toFixed(2)} MB`);
console.log("---");

// Test 2: Ohnrscript parseFrame
forceGC();
const startHeapOhn = process.memoryUsage().heapUsed;
const startTimeOhn = performance.now();

for (let i = 0; i < TEST_ITERATIONS; i++) {
  parseFrame(framesForOhn[i]);
}

const endTimeOhn = performance.now();
const endHeapOhn = process.memoryUsage().heapUsed;
const timeOhn = endTimeOhn - startTimeOhn;
const heapDeltaOhn = (endHeapOhn - startHeapOhn) / 1024 / 1024;

console.log("Test 2: Ohnrscript parseFrame (In-Place Mutation)");
console.log(`Time: ${timeOhn.toFixed(2)} ms`);
console.log(`Heap Delta: ${heapDeltaOhn.toFixed(2)} MB`);
console.log("---");

console.log(`Performance Diff: Ohnrscript is ${(timeStandard / timeOhn).toFixed(2)}x faster!`);
console.log(`Memory Diff: Ohnrscript reduced heap allocations by ${(heapDeltaStandard - heapDeltaOhn).toFixed(2)} MB!`);

// Prevent script from exiting immediately if `ws` queued stuff
setTimeout(() => {
  console.log("Benchmark complete.");
  process.exit(0);
}, 500);
