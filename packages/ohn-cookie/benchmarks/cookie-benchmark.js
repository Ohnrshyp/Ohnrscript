const cookie = require('cookie');
const { getCookie } = require('../src/ohn-cookie');
const { performance } = require('perf_hooks');

const ITERATIONS = 2_000_000;
const cookieString = "analytic_1=a1; analytic_2=a2; theme=dark; language=en_US; session_id=super_secret_session_token_12345; user_type=premium; ab_test=groupB; last_login=2026-06-29; tracking_id=track_xyz987; preferences=notifications_enabled";
const cookieBuffer = Buffer.from(cookieString);

function forceGC() {
  try {
    if (global.gc) {
      global.gc();
    } else {
      console.error("Error: Run node with --expose-gc flag");
      process.exit(1);
    }
  } catch (e) {
    console.error("Error: Run node with --expose-gc flag");
    process.exit(1);
  }
}

console.log(`Starting Cookie Parser Benchmark`);
console.log(`Iterations: ${ITERATIONS.toLocaleString()}`);
console.log(`Cookie payload length: ${cookieString.length} bytes (10 distinct cookies)`);
console.log("---");

// Test 1: Standard cookie.parse
forceGC();
const startHeapStandard = process.memoryUsage().heapUsed;
const startTimeStandard = performance.now();

let valStandard = null;
for (let i = 0; i < ITERATIONS; i++) {
  const parsed = cookie.parseCookie(cookieString);
  valStandard = parsed["session_id"];
}

const endTimeStandard = performance.now();
const endHeapStandard = process.memoryUsage().heapUsed;
const timeStandard = endTimeStandard - startTimeStandard;
const heapDeltaStandard = (endHeapStandard - startHeapStandard) / 1024 / 1024;

console.log("Test 1: Standard `cookie` package");
console.log(`Extracted value: ${valStandard}`);
console.log(`Time: ${timeStandard.toFixed(2)} ms`);
console.log(`Heap Delta: ${heapDeltaStandard.toFixed(2)} MB`);
console.log("---");

// Test 2: Ohnrscript getCookie
forceGC();
const startHeapOhn = process.memoryUsage().heapUsed;
const startTimeOhn = performance.now();

let valOhn = null;
for (let i = 0; i < ITERATIONS; i++) {
  valOhn = getCookie(cookieBuffer, "session_id");
}

const endTimeOhn = performance.now();
const endHeapOhn = process.memoryUsage().heapUsed;
const timeOhn = endTimeOhn - startTimeOhn;
const heapDeltaOhn = (endHeapOhn - startHeapOhn) / 1024 / 1024;

console.log("Test 2: Ohnrscript getCookie");
console.log(`Extracted value: ${valOhn}`);
console.log(`Time: ${timeOhn.toFixed(2)} ms`);
console.log(`Heap Delta: ${heapDeltaOhn.toFixed(2)} MB`);
console.log("---");

console.log(`Performance Diff: Ohnrscript is ${(timeStandard / timeOhn).toFixed(2)}x faster!`);
console.log(`Memory Diff: Ohnrscript reduced heap allocations by ${(heapDeltaStandard - heapDeltaOhn).toFixed(2)} MB!`);
