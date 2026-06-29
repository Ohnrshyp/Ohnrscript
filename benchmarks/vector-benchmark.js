const { mapVector } = require('../packages/ohn-vector/examples/ohn-vector');

const ITERATIONS = 100_000;
const VECTOR_SIZE = 1536; // OpenAI embeddings size

function mapVectorSlice(buffer) {
    // Memory-safe copy
    const copiedBuffer = buffer.slice(0, VECTOR_SIZE * 4);
    return new Float32Array(copiedBuffer.buffer, copiedBuffer.byteOffset, VECTOR_SIZE);
}

// 1. Generate 1536 random floats
const floats = new Float32Array(VECTOR_SIZE);
for (let i = 0; i < VECTOR_SIZE; i++) {
    floats[i] = Math.random();
}

// 2. Create the JSON payload
const jsonPayload = JSON.stringify(Array.from(floats));

// 3. Create the raw binary Buffer payload
const binaryBuffer = Buffer.allocUnsafe(VECTOR_SIZE * 4);
for (let i = 0; i < VECTOR_SIZE; i++) {
    binaryBuffer.writeFloatLE(floats[i], i * 4);
}

function runBenchmark() {
    console.log(`Running benchmarks for ${ITERATIONS} iterations (Vector size: ${VECTOR_SIZE})...\n`);

    // --- TEST 1: Standard JSON Parsing ---
    try { if (global.gc) global.gc(); } catch (e) {}
    
    const startHeapJSON = process.memoryUsage().heapUsed;
    const startTimeJSON = performance.now();
    
    let jsonSum = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const jsonResult = JSON.parse(jsonPayload);
        jsonSum += jsonResult[0];
    }
    
    const endTimeJSON = performance.now();
    const endHeapJSON = process.memoryUsage().heapUsed;
    
    console.log("=== Test 1: Standard JSON.parse ===");
    console.log(`Time: ${(endTimeJSON - startTimeJSON).toFixed(2)} ms`);
    console.log(`Heap Delta: ${((endHeapJSON - startHeapJSON) / 1024 / 1024).toFixed(2)} MB\n`);

    // --- TEST 2: Ohnrscript Zero-Allocation ---
    try { if (global.gc) global.gc(); } catch (e) {}
    
    const startHeapOhn = process.memoryUsage().heapUsed;
    const startTimeOhn = performance.now();
    
    let ohnSum = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const ohnResult = mapVector(binaryBuffer);
        ohnSum += ohnResult[0];
    }
    
    const endTimeOhn = performance.now();
    const endHeapOhn = process.memoryUsage().heapUsed;
    
    console.log("=== Test 2: Ohnrscript Zero-Copy mapVector ===");
    console.log(`Time: ${(endTimeOhn - startTimeOhn).toFixed(2)} ms`);
    console.log(`Heap Delta: ${((endHeapOhn - startHeapOhn) / 1024 / 1024).toFixed(2)} MB\n`);

    // --- TEST 3: Ohnrscript Memory-Safe ---
    try { if (global.gc) global.gc(); } catch (e) {}
    
    const startHeapSafe = process.memoryUsage().heapUsed;
    const startTimeSafe = performance.now();
    
    let safeSum = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const safeResult = mapVectorSlice(binaryBuffer);
        safeSum += safeResult[0];
    }
    
    const endTimeSafe = performance.now();
    const endHeapSafe = process.memoryUsage().heapUsed;
    
    console.log("=== Test 3: Ohnrscript Memory-Safe Copy (.slice) ===");
    console.log(`Time: ${(endTimeSafe - startTimeSafe).toFixed(2)} ms`);
    console.log(`Heap Delta: ${((endHeapSafe - startHeapSafe) / 1024 / 1024).toFixed(2)} MB\n`);
    
    // Performance Multipliers
    const timeSpeedupZero = (endTimeJSON - startTimeJSON) / (endTimeOhn - startTimeOhn);
    const timeSpeedupSafe = (endTimeJSON - startTimeJSON) / (endTimeSafe - startTimeSafe);
    
    console.log(`🚀 Ohnrscript Zero-Copy is ${timeSpeedupZero.toFixed(2)}x faster than JSON!`);
    console.log(`🚀 Ohnrscript Memory-Safe is ${timeSpeedupSafe.toFixed(2)}x faster than JSON!`);
}

runBenchmark();
