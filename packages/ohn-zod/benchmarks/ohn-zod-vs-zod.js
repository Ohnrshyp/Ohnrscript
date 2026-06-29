const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { decode } = require('cbor-x');
const babel = require('@babel/core');
const cborPlugin = require('../../../core/src/plugins/babel-plugin-cbor-aot');

// 1. Compile UserPayload from ohn-zod.test.ohn
function transpileFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const result = babel.transformSync(code, {
    parserOpts: {
      plugins: [
        'typescript',
        ['decorators', { decoratorsBeforeExport: true }]
      ]
    },
    plugins: [cborPlugin]
  });
  return result.code;
}

const targetFile = path.join(__dirname, '../tests/ohn-zod.test.ohn');
const outputCode = transpileFile(targetFile);

const UserPayload = eval(`
  (function() {
    var module = { exports: {} };
    ${outputCode}
    return module.exports;
  })();
`);

// 2. Standard Zod schema equivalent
const UserPayloadSchema = z.object({
  age: z.number().int().min(1).max(1000),
  name: z.string().max(16)
});

// 3. Construct Malicious Payload (50MB string length)
const validObj = new UserPayload();
validObj.age = 500;
validObj.name = "John Doe";
const baseBuf = validObj.toCBOR();

// Map header (1) + Key 'age' (5) + Value age (5) + Key 'name' (5) = 16 bytes
// Replacing the 16th byte (index 15) which is the string header 0x68
const maliciousLength = 50_000_000;
const maliciousBuf = Buffer.concat([
  baseBuf.subarray(0, 15),
  Buffer.from([0x7a, (maliciousLength >>> 24) & 0xff, (maliciousLength >>> 16) & 0xff, (maliciousLength >>> 8) & 0xff, maliciousLength & 0xff]),
  Buffer.from("John Doe") // partial payload
]);

console.log("Benchmarking Standard Zod + cbor-x vs Ohnrscript AOT CBOR...");
console.log("Iterations: 100,000\n");

const ITERATIONS = 100_000;
let zodErrors = 0;
let ohnErrors = 0;

function runZodBenchmark() {
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const parsed = decode(maliciousBuf);
      UserPayloadSchema.parse(parsed);
    } catch (e) {
      zodErrors++;
    }
  }
  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  return { time: endTime - startTime, memoryDelta: endMemory - startMemory };
}

function runOhnBenchmark() {
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      UserPayload.fromCBOR(maliciousBuf);
    } catch (e) {
      ohnErrors++;
    }
  }
  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  return { time: endTime - startTime, memoryDelta: endMemory - startMemory };
}

// Warmup
try { UserPayload.fromCBOR(maliciousBuf); } catch(e) {}
try { UserPayloadSchema.parse(decode(maliciousBuf)); } catch(e) {}

// Garbage collect before starting if possible (requires --expose-gc)
if (global.gc) {
  global.gc();
}

const zodResult = runZodBenchmark();

if (global.gc) {
  global.gc();
}

const ohnResult = runOhnBenchmark();

console.log(`=== RESULTS ===`);
console.log(`Standard Zod + cbor-x:`);
console.log(`  Time: ${zodResult.time.toFixed(2)} ms`);
console.log(`  Errors caught: ${zodErrors}`);
console.log(`  Heap Memory Delta: ${(zodResult.memoryDelta / 1024 / 1024).toFixed(2)} MB`);

console.log(`\nOhnrscript AOT Validation:`);
console.log(`  Time: ${ohnResult.time.toFixed(2)} ms`);
console.log(`  Errors caught: ${ohnErrors}`);
console.log(`  Heap Memory Delta: ${(ohnResult.memoryDelta / 1024 / 1024).toFixed(2)} MB`);

// We expect Ohnrscript to be orders of magnitude faster and use practically no memory because
// it throws on length checking before allocating the buffer/string, whereas cbor-x will try to
// parse the 50MB and likely throw a RangeError or Out of Memory error during allocation attempts, 
// causing massive GC churn.
