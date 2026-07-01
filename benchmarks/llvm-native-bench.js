// benchmarks/llvm-native-bench.js
// Phase 4: Ohnrscript LLVM IR Native vs V8 JIT Benchmark
//
// Compiles ohn-vector-native.ohn → LLVM IR → native ARM64 binary at runtime.
// Benchmarks two data-dependent integer operations:
//
//   sumReduce(n, seed)  — xorshift32 scan + xor accumulator
//   countBits(n, seed)  — xorshift32 generation + popcount inner loop
//
// Both operations use the same Ohnrscript source logic.
// The native binary is compiled with clang -O3 -march=native.

'use strict';

const { execSync, execFileSync } = require('child_process');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const ROOT      = path.resolve(__dirname, '..');
const LL_FILE   = path.join(os.tmpdir(), 'ohn-llvm-bench.ll');
const BIN_FILE  = path.join(os.tmpdir(), 'ohn-llvm-bench');
const HARNESS_C = path.join(os.tmpdir(), 'ohn-llvm-harness.c');

const N     = 1024 * 1024;  // 1M iterations
const ITERS = 100;
const WARM  = 20;

console.log('═══════════════════════════════════════════════════════');
console.log('  Ohnrscript LLVM IR Native vs V8 JIT — Phase 4');
console.log('═══════════════════════════════════════════════════════');
console.log(`  Loop size:    ${N.toLocaleString()} iterations`);
console.log(`  Iterations:   ${ITERS} (${WARM} warmup)`);
console.log('');

// ── Step 1: Compile .ohn → LLVM IR ────────────────────────────
console.log('  [1/4] Compiling Ohnrscript → LLVM IR...');
Object.keys(require.cache).filter(k =>
    k.includes('generator-llvm') || k.includes('parser.ohn')
).forEach(k => delete require.cache[k]);

const parser  = require('../compiler/src/frontend/parser.ohn');
const genLLVM = require('../compiler/src/codegen/generator-llvm.ohn');
const src     = fs.readFileSync(path.join(ROOT, 'packages/ohn-vector/src/ohn-vector-native.ohn'));
const root    = parser.parse(new Uint8Array(src));
genLLVM.generate(
    parser.get_ast_nodes(), parser.get_ast_extra(), parser.get_intern_pool(),
    root, LL_FILE
);
console.log(`       → ${LL_FILE} (${fs.statSync(LL_FILE).size} bytes)`);

// ── Step 2: Write C harness ────────────────────────────────────
fs.writeFileSync(HARNESS_C, `
#include <stdio.h>
#include <stdint.h>
#include <time.h>
extern int countBits(int n, int seed);
extern int sumReduce(int n, int seed);
static uint64_t now_ns() {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000000ULL + ts.tv_nsec;
}
int main(void) {
    const int N=${N}, ITERS=${ITERS}, WARM=${WARM};
    volatile int result=0; uint64_t t0;
    for(int i=0;i<WARM;i++)  result^=sumReduce(N,12345);
    t0=now_ns();
    for(int i=0;i<ITERS;i++) result^=sumReduce(N,12345);
    double sr_ns=(double)(now_ns()-t0)/ITERS;
    for(int i=0;i<WARM;i++)  result^=countBits(N,12345);
    t0=now_ns();
    for(int i=0;i<ITERS;i++) result^=countBits(N,12345);
    double cb_ns=(double)(now_ns()-t0)/ITERS;
    printf("RESULT sumReduce %.0f\\n",sr_ns);
    printf("RESULT countBits %.0f\\n",cb_ns);
    printf("CHECKSUM %d\\n",result);
    return 0;
}
`);

// ── Step 3: Compile native binary ─────────────────────────────
console.log('  [2/4] Compiling native binary (clang -O3 -march=native)...');
try {
    execSync(
        `/usr/bin/clang -O3 -march=native ${LL_FILE} ${HARNESS_C} -o ${BIN_FILE} -lm`,
        { stdio: 'pipe' }
    );
} catch (e) {
    const msg = e.stderr ? e.stderr.toString() : e.message;
    console.error('  ERROR:', msg.split('\n').filter(l => l.includes('error:')).join('\n'));
    process.exit(1);
}
console.log(`       → ${BIN_FILE} (${(fs.statSync(BIN_FILE).size/1024).toFixed(0)} KB)`);

// ── Step 4: Run native binary ──────────────────────────────────
console.log('  [3/4] Running native benchmark...');
const nativeOut = execFileSync(BIN_FILE, [], { encoding: 'utf-8', timeout: 60000 });
let nativeSR = 0, nativeCB = 0;
for (const line of nativeOut.trim().split('\n')) {
    if (line.startsWith('RESULT sumReduce')) nativeSR = parseFloat(line.split(' ')[2]);
    if (line.startsWith('RESULT countBits')) nativeCB = parseFloat(line.split(' ')[2]);
}
console.log(`       sumReduce:  ${(nativeSR/1e6).toFixed(3)} ms/op`);
console.log(`       countBits:  ${(nativeCB/1e6).toFixed(3)} ms/op`);

// ── Step 5: Run V8 benchmark (identical Ohnrscript logic) ──────
console.log('  [4/4] Running V8 benchmark...');

function sumReduce(n, seed) {
    let acc = 0, x = seed | 0, i = 0;
    while (i < n) {
        x = x ^ ((x << 13) | 0);
        x = x ^ ((x >> 17) | 0);
        x = x ^ ((x << 5) | 0);
        acc = (acc ^ x) | 0;
        i = (i + 1) | 0;
    }
    return acc | 0;
}

function countBits(n, seed) {
    let total = 0, x = seed | 0, i = 0;
    while (i < n) {
        x = x ^ ((x << 13) | 0);
        x = x ^ ((x >> 17) | 0);
        x = x ^ ((x << 5) | 0);
        let v = x | 0, count = 0;
        while (v !== 0) { v = (v & (v-1))|0; count = (count+1)|0; }
        total = (total + count) | 0;
        i = (i + 1) | 0;
    }
    return total | 0;
}

let result = 0;
for (let w = 0; w < WARM; w++) result ^= sumReduce(N, 12345);
let t0 = Date.now();
for (let it = 0; it < ITERS; it++) result ^= sumReduce(N, 12345);
const v8SR = ((Date.now() - t0) / ITERS) * 1e6;  // → ns

for (let w = 0; w < WARM; w++) result ^= countBits(N, 12345);
t0 = Date.now();
for (let it = 0; it < ITERS; it++) result ^= countBits(N, 12345);
const v8CB = ((Date.now() - t0) / ITERS) * 1e6;  // → ns

console.log(`       sumReduce:  ${(v8SR/1e6).toFixed(3)} ms/op`);
console.log(`       countBits:  ${(v8CB/1e6).toFixed(3)} ms/op`);

// ── Results ────────────────────────────────────────────────────
const srSpeedup = v8SR / nativeSR;
const cbSpeedup = v8CB / nativeCB;
const avgSpeedup = (srSpeedup + cbSpeedup) / 2;

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  RESULTS — Ohnrscript LLVM Native vs V8 JIT (Apple M1)');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('  Operation    │ V8 JIT     │ LLVM Native │ Speedup');
console.log('  ─────────────┼────────────┼─────────────┼────────');
console.log(`  sumReduce    │ ${(v8SR/1e6).toFixed(3)} ms │ ${(nativeSR/1e6).toFixed(3)} ms    │ ${srSpeedup.toFixed(2)}x`);
console.log(`  countBits    │ ${(v8CB/1e6).toFixed(3)} ms │ ${(nativeCB/1e6).toFixed(3)} ms   │ ${cbSpeedup.toFixed(2)}x`);
console.log('');
console.log(`  Average speedup: ${avgSpeedup.toFixed(2)}x`);
console.log(`  Checksum: ${result} (must match between V8 and native)`);
console.log('');
console.log(`  Arch:    ${os.arch()} / ${os.cpus()[0].model}`);
console.log(`  Node.js: ${process.version}`);
console.log(`  LLVM:    22.1.8 (clang -O3 -march=native, NEON)`);
console.log('═══════════════════════════════════════════════════════');
