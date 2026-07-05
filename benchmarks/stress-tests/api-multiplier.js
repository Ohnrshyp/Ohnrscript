const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { decode } = require('cbor-x');
const { v4: uuidv4 } = require('uuid');
const babel = require('@babel/core');
const cborPlugin = require('../core/src/plugins/babel-plugin-cbor-aot');
const { generateUUIDv4 } = require('../packages/ohn-uuid/src/ohn-uuid.js');

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

const targetFile = path.join(__dirname, '../packages/ohn-zod/tests/ohn-zod.test.ohn');
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

// 3. Construct Valid Payload for the microservice endpoint
const validObj = new UserPayload();
validObj.age = 28;
validObj.name = "Jordan";
const validBuf = validObj.toCBOR();

console.log("--- The API Multiplier Effect Benchmark ---");
console.log("Simulating a standard Node.js microservice registration endpoint.");
console.log("Steps: 1) Parse CBOR  2) Validate Schema  3) Generate UUID ID");
console.log("Iterations: 1,000,000\n");

const ITERATIONS = 1_000_000;

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function runStandardStack() {
  try { if (global.gc) global.gc(); } catch (e) {}
  
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  for (let i = 0; i < ITERATIONS; i++) {
    // 1. Receive & Parse CBOR (Allocates JS objects)
    const parsed = decode(validBuf);
    
    // 2. Validate Data (Allocates Zod recursive objects and error maps)
    const validated = UserPayloadSchema.parse(parsed);
    
    // 3. Assign ID (Allocates V8 strings and crosses C++ boundary)
    const newId = uuidv4();
    
    // In a real app we'd save this to DB, here we just assign to ensure V8 doesn't optimize it away
    validated.id = newId;
  }
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  return { time: endTime - startTime, memoryDelta: endMemory - startMemory };
}

function runOhnrscriptStack() {
  try { if (global.gc) global.gc(); } catch (e) {}
  
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  for (let i = 0; i < ITERATIONS; i++) {
    // 1 & 2. Parse & Validate purely in AOT machine code (Zero JS Object Allocation for validation)
    const validated = UserPayload.fromCBOR(validBuf);
    
    // 3. Assign ID (Zero string allocation, reads from JS entropy pool)
    const newId = generateUUIDv4();
    
    // Store as raw ASCII byte array
    validated.id = newId;
  }
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  return { time: endTime - startTime, memoryDelta: endMemory - startMemory };
}

// Warmup
try { UserPayload.fromCBOR(validBuf); } catch(e) {}
try { UserPayloadSchema.parse(decode(validBuf)); } catch(e) {}

const standardResult = runStandardStack();
const ohnrResult = runOhnrscriptStack();

console.log(`=== RESULTS ===`);
console.log(`Standard Stack (cbor-x + Zod + uuid):`);
console.log(`  Time: ${standardResult.time.toFixed(2)} ms`);
console.log(`  Heap Memory Delta: ${formatMB(standardResult.memoryDelta)} MB`);

console.log(`\nOhnrscript Stack (AOT Validation + Zero-Alloc UUID):`);
console.log(`  Time: ${ohnrResult.time.toFixed(2)} ms`);
console.log(`  Heap Memory Delta: ${formatMB(ohnrResult.memoryDelta)} MB`);

console.log(`\n=== SUMMARY ===`);
console.log(`Speedup: ${(standardResult.time / ohnrResult.time).toFixed(2)}x faster`);
console.log(`Memory Saved: ${formatMB(standardResult.memoryDelta - ohnrResult.memoryDelta)} MB less heap churn per 1M requests`);
