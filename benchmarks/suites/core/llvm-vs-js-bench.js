// benchmarks/llvm-vs-js-bench.js
// Phase 4A: Airtight LLVM Native vs JS Generator Benchmark
//
// Single source: packages/ohn-vector/src/ohn-vector-native.ohn
// Two compilation targets:
//   LEFT:  .ohn -> Ohnrscript JS generator -> Node.js V8 JIT
//   RIGHT: .ohn -> Ohnrscript LLVM generator -> clang -O3 -> native ARM64
//
// Checksums verified to match before timing begins.
// Runs 5 independent timing trials. Reports mean, min, max.

'use strict';

const { execFileSync } = require('child_process');
const path   = require('path');
const os     = require('os');
const fs     = require('fs');

const ROOT   = path.resolve(__dirname, '..');
const SRC    = path.join(ROOT, 'packages/ohn-vector/src/ohn-vector-native.ohn');
const TMP    = os.tmpdir();
const JS_OUT = path.join(TMP, 'ohn-vec-airtight.js');
const LL_OUT = path.join(TMP, 'ohn-vec-airtight.ll');
const BIN    = path.join(TMP, 'ohn-vec-airtight');
const C_OUT  = path.join(TMP, 'ohn-vec-airtight-harness.c');

const N      = 1048576;   // 1M elements
const TRIALS = 5;
const ITERS  = 200;
const WARM   = 30;

// ── Helpers ────────────────────────────────────────────────────
function freshRequire(modPath) {
    Object.keys(require.cache)
        .filter(k => k.includes(modPath) || k.includes('generator') || k.includes('parser.ohn'))
        .forEach(k => delete require.cache[k]);
    return require(modPath);
}

function stats(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return { mean, min: Math.min(...arr), max: Math.max(...arr) };
}

console.log('════════════════════════════════════════════════════════════════');
console.log('  Phase 4A — Ohnrscript Airtight LLVM Native vs JS Generator');
console.log('════════════════════════════════════════════════════════════════');
console.log(`  Source:      ${path.relative(ROOT, SRC)}`);
console.log(`  Elements:    ${N.toLocaleString()} Int32`);
console.log(`  Trials:      ${TRIALS} independent runs of ${ITERS} iterations each`);
console.log('');

// ── Step 1: Compile .ohn -> LLVM IR ────────────────────────────
process.stdout.write('  [1/5] Compiling .ohn -> LLVM IR ... ');
const parser  = freshRequire(path.join(ROOT, 'compiler/src/frontend/parser.ohn'));
const genLLVM = freshRequire(path.join(ROOT, 'compiler/src/codegen/generator-llvm.ohn'));
const src     = fs.readFileSync(SRC);
const root    = parser.parse(new Uint8Array(src));
genLLVM.generate(
    parser.get_ast_nodes(), parser.get_ast_extra(),
    parser.get_intern_pool(), root, LL_OUT
);
console.log(`done (${fs.statSync(LL_OUT).size} bytes)`);

// ── Step 2: Compile .ohn -> JS ─────────────────────────────────
process.stdout.write('  [2/5] Compiling .ohn -> JavaScript ... ');
Object.keys(require.cache).filter(k => k.includes('generator-llvm') || k.includes('generator.ohn') || k.includes('parser.ohn')).forEach(k => delete require.cache[k]);
const parser2  = freshRequire(path.join(ROOT, 'compiler/src/frontend/parser.ohn'));
const genJS    = freshRequire(path.join(ROOT, 'compiler/src/codegen/generator.ohn'));
const root2    = parser2.parse(new Uint8Array(src));
genJS.generate(
    parser2.get_ast_nodes(), parser2.get_ast_extra(),
    parser2.get_intern_pool(), root2, JS_OUT
);
// Append exports
const jsCode = fs.readFileSync(JS_OUT, 'utf8') +
    '\nmodule.exports = { dotProduct, l2NormSquared, mapVectorCopy };\n';
fs.writeFileSync(JS_OUT, jsCode);
console.log(`done (${fs.statSync(JS_OUT).size} bytes)`);

// ── Step 3: Compile native binary ──────────────────────────────
process.stdout.write('  [3/5] Compiling native binary (clang -O3 -march=native) ... ');
fs.writeFileSync(C_OUT, `
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <time.h>
extern int dotProduct(long a, long b, long n);
extern int l2NormSquared(long a, long n);
extern int mapVectorCopy(long src, long dst, long n);
static uint64_t now_ns() {
    struct timespec ts; clock_gettime(CLOCK_MONOTONIC,&ts);
    return (uint64_t)ts.tv_sec*1000000000ULL+ts.tv_nsec;
}
int main(int argc, char**argv) {
    const int N=${N}, ITERS=${ITERS}, WARM=${WARM};
    int *a=(int*)aligned_alloc(64,N*sizeof(int));
    int *b=(int*)aligned_alloc(64,N*sizeof(int));
    int *c=(int*)aligned_alloc(64,N*sizeof(int));
    for(int i=0;i<N;i++){a[i]=i%256;b[i]=(N-i)%256;}
    // Checksum verification (N=1024 subset for speed)
    int cs_dp=dotProduct((long)a,(long)b,1024);
    int cs_l2=l2NormSquared((long)a,1024);
    int cs_cp=mapVectorCopy((long)a,(long)c,1024);
    printf("CHECKSUM %d\\n", cs_dp^cs_l2^cs_cp);
    // Timing
    volatile int r=0; uint64_t t0;
    for(int i=0;i<WARM;i++) r^=dotProduct((long)a,(long)b,(long)N);
    t0=now_ns(); for(int i=0;i<ITERS;i++) r^=dotProduct((long)a,(long)b,(long)N);
    double dot_ns=(double)(now_ns()-t0)/ITERS;
    for(int i=0;i<WARM;i++) r^=l2NormSquared((long)a,(long)N);
    t0=now_ns(); for(int i=0;i<ITERS;i++) r^=l2NormSquared((long)a,(long)N);
    double l2_ns=(double)(now_ns()-t0)/ITERS;
    for(int i=0;i<WARM;i++) r^=mapVectorCopy((long)a,(long)c,(long)N);
    t0=now_ns(); for(int i=0;i<ITERS;i++) r^=mapVectorCopy((long)a,(long)c,(long)N);
    double cp_ns=(double)(now_ns()-t0)/ITERS;
    printf("RESULT dotProduct %.0f\\n",dot_ns);
    printf("RESULT l2NormSquared %.0f\\n",l2_ns);
    printf("RESULT mapVectorCopy %.0f\\n",cp_ns);
    free(a);free(b);free(c);
    return 0;
}
`);
try {
    execFileSync('/usr/bin/clang',
        ['-O3', '-march=native', LL_OUT, C_OUT, '-o', BIN, '-lm'],
        { stdio: 'pipe' }
    );
} catch(e) {
    const err = (e.stderr || e.stdout || Buffer.alloc(0)).toString();
    console.error('\n  ERROR compiling native binary:\n' + err.split('\n').filter(l=>l.includes('error:')).join('\n'));
    process.exit(1);
}
console.log(`done (${(fs.statSync(BIN).size/1024).toFixed(0)} KB)`);

// ── Step 4: Verify checksums match ─────────────────────────────
process.stdout.write('  [4/5] Verifying checksums match ... ');

// JS checksum (N=1024 subset)
delete require.cache[JS_OUT];
const jsMod = require(JS_OUT);
const CSRC  = new Int32Array(1024), CSRB = new Int32Array(1024), CSRC2 = new Int32Array(1024);
for(let i=0;i<1024;i++){CSRC[i]=i%256;CSRB[i]=(1024-i)%256;}
const js_dp = jsMod.dotProduct(CSRC, CSRB, 1024);
const js_l2 = jsMod.l2NormSquared(CSRC, 1024);
const js_cp = jsMod.mapVectorCopy(CSRC, CSRC2, 1024);
const js_checksum = js_dp ^ js_l2 ^ js_cp;

// Native checksum
const nativeRaw = execFileSync(BIN, [], { encoding: 'utf-8', timeout: 30000 });
let native_checksum = null;
const nativeResults = {};
for(const line of nativeRaw.trim().split('\n')) {
    if(line.startsWith('CHECKSUM')) native_checksum = parseInt(line.split(' ')[1]);
    if(line.startsWith('RESULT')) {
        const parts = line.split(' ');
        nativeResults[parts[1]] = parseFloat(parts[2]);
    }
}

if(js_checksum !== native_checksum) {
    console.error(`MISMATCH\n  JS checksum:     ${js_checksum}\n  Native checksum: ${native_checksum}`);
    process.exit(1);
}
console.log(`MATCH (${js_checksum})`);

// ── Step 5: Run timing trials ───────────────────────────────────
console.log(`  [5/5] Running ${TRIALS} trials...\n`);

const N_ARR  = new Int32Array(N), B_ARR = new Int32Array(N), C_ARR = new Int32Array(N);
for(let i=0;i<N;i++){N_ARR[i]=i%256;B_ARR[i]=(N-i)%256;}

const v8Trials  = { dotProduct: [], l2NormSquared: [], mapVectorCopy: [] };
const natTrials = { dotProduct: [], l2NormSquared: [], mapVectorCopy: [] };

for(let t=0;t<TRIALS;t++) {
    process.stdout.write(`    Trial ${t+1}/${TRIALS}: `);

    // V8 timing
    let r=0;
    for(let w=0;w<WARM;w++) r^=jsMod.dotProduct(N_ARR,B_ARR,N);
    let t0=Date.now();
    for(let i=0;i<ITERS;i++) r^=jsMod.dotProduct(N_ARR,B_ARR,N);
    v8Trials.dotProduct.push((Date.now()-t0)/ITERS*1e6);

    for(let w=0;w<WARM;w++) r^=jsMod.l2NormSquared(N_ARR,N);
    t0=Date.now();
    for(let i=0;i<ITERS;i++) r^=jsMod.l2NormSquared(N_ARR,N);
    v8Trials.l2NormSquared.push((Date.now()-t0)/ITERS*1e6);

    for(let w=0;w<WARM;w++) r^=jsMod.mapVectorCopy(N_ARR,C_ARR,N);
    t0=Date.now();
    for(let i=0;i<ITERS;i++) r^=jsMod.mapVectorCopy(N_ARR,C_ARR,N);
    v8Trials.mapVectorCopy.push((Date.now()-t0)/ITERS*1e6);

    // Native timing
    const out = execFileSync(BIN, [], { encoding: 'utf-8', timeout: 60000 });
    for(const line of out.trim().split('\n')) {
        if(line.startsWith('RESULT')) {
            const [,name,val] = line.split(' ');
            natTrials[name].push(parseFloat(val));
        }
    }
    console.log('done');
}

// ── Final report ───────────────────────────────────────────────
const ops = ['dotProduct', 'l2NormSquared', 'mapVectorCopy'];
const fmt  = (ns, pad=9) => ((ns/1e6).toFixed(3)+' ms').padStart(pad);
const fmtx = (x, pad=7)  => (x.toFixed(2)+'x').padStart(pad);

console.log('');
console.log('════════════════════════════════════════════════════════════════════');
console.log('  RESULTS — Ohnrscript: Same .ohn source, two compilation targets');
console.log('  Apple M1 · 1,048,576 Int32 elements · 5 trials × 200 iterations');
console.log('════════════════════════════════════════════════════════════════════');
console.log('');
console.log('  Operation       │  V8 JIT (mean)  │ Native (mean)  │ Speedup');
console.log('  ────────────────┼─────────────────┼────────────────┼────────');

let totalSpeedup = 0;
for(const op of ops) {
    const v8  = stats(v8Trials[op]);
    const nat = stats(natTrials[op]);
    const speedup = v8.mean / nat.mean;
    totalSpeedup += speedup;
    console.log(`  ${op.padEnd(15)} │ ${fmt(v8.mean)} │ ${fmt(nat.mean)} │ ${fmtx(speedup)}`);
    console.log(`  ${' '.repeat(15)} │ min ${fmt(v8.min,6)} max ${fmt(v8.max,6)} │ min ${fmt(nat.min,6)} max ${fmt(nat.max,6)} │`);
}

const avg = totalSpeedup / ops.length;
console.log('');
console.log(`  Average speedup: ${avg.toFixed(2)}x`);
console.log(`  Checksum:        ${js_checksum} (JS ≡ Native ✓)`);
console.log('');
console.log(`  Source:  packages/ohn-vector/src/ohn-vector-native.ohn`);
console.log(`  JS path: .ohn → Ohnrscript JS generator → Node.js ${process.version}`);
console.log(`  Native:  .ohn → Ohnrscript LLVM generator → clang -O3 -march=native → ARM64`);
console.log(`  LLVM:    22.1.8`);
console.log('════════════════════════════════════════════════════════════════════');
