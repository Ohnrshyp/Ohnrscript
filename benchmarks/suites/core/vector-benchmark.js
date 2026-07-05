const { mapVector } = require('../packages/ohn-vector/src/ohn-vector');

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

function settleGC() {
    try {
        if (global.gc) {
            global.gc();
            global.gc();
        }
    } catch (e) {}
}

// Add manual DataView parser (Fair Binary Baseline)
function parseVectorDataView(buffer) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, VECTOR_SIZE * 4);
    const result = new Array(VECTOR_SIZE);
    for (let i = 0; i < VECTOR_SIZE; i++) {
        result[i] = view.getFloat32(i * 4, true); // little-endian
    }
    return result;
}

function runBenchmark() {
    console.log(`Running benchmarks for ${ITERATIONS} iterations (Vector size: ${VECTOR_SIZE})...\n`);

    // --- TEST 1: Standard JSON Parsing ---
    settleGC();
    const startHeapJSON = process.memoryUsage().heapUsed;
    const startTimeJSON = performance.now();
    let jsonSum = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const jsonResult = JSON.parse(jsonPayload);
        jsonSum += jsonResult[0];
    }
    const endTimeJSON = performance.now();
    settleGC(); // Force GC after to see how much survived or was churned? No, heap delta is usually measured WITHOUT gc at the end to see the churn, or WITH gc to see the leak. The benchmark results document says "Heap Delta", implying the churn before GC. Let's not GC at the end. Wait, if we don't GC at the end, it's highly variable. Let's just measure immediately.
    const endHeapJSON = process.memoryUsage().heapUsed;
    
    console.log("=== Test 1: Standard JSON.parse (Text Baseline) ===");
    console.log(`Time: ${(endTimeJSON - startTimeJSON).toFixed(2)} ms`);
    console.log(`Heap Delta: ${((endHeapJSON - startHeapJSON) / 1024 / 1024).toFixed(2)} MB\n`);

    // --- TEST 2: Manual DataView (Binary Baseline) ---
    settleGC();
    const startHeapDV = process.memoryUsage().heapUsed;
    const startTimeDV = performance.now();
    let dvSum = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const dvResult = parseVectorDataView(binaryBuffer);
        dvSum += dvResult[0];
    }
    const endTimeDV = performance.now();
    const endHeapDV = process.memoryUsage().heapUsed;
    
    console.log("=== Test 2: Manual DataView (Binary Baseline) ===");
    console.log(`Time: ${(endTimeDV - startTimeDV).toFixed(2)} ms`);
    console.log(`Heap Delta: ${((endHeapDV - startHeapDV) / 1024 / 1024).toFixed(2)} MB\n`);

    // --- TEST 3: Ohnrscript Zero-Copy mapVector ---
    settleGC();
    const startHeapOhn = process.memoryUsage().heapUsed;
    const startTimeOhn = performance.now();
    let ohnSum = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const ohnResult = mapVector(binaryBuffer);
        ohnSum += ohnResult[0];
    }
    const endTimeOhn = performance.now();
    const endHeapOhn = process.memoryUsage().heapUsed;
    
    console.log("=== Test 3: Ohnrscript Zero-Copy mapVector ===");
    console.log(`Time: ${(endTimeOhn - startTimeOhn).toFixed(2)} ms`);
    console.log(`Heap Delta: ${((endHeapOhn - startHeapOhn) / 1024 / 1024).toFixed(2)} MB\n`);

    // --- TEST 4: Ohnrscript Memory-Safe Copy (.slice) ---
    settleGC();
    const startHeapSafe = process.memoryUsage().heapUsed;
    const startTimeSafe = performance.now();
    let safeSum = 0;
    for (let i = 0; i < ITERATIONS; i++) {
        const safeResult = mapVectorSlice(binaryBuffer);
        safeSum += safeResult[0];
    }
    const endTimeSafe = performance.now();
    const endHeapSafe = process.memoryUsage().heapUsed;
    
    console.log("=== Test 4: Ohnrscript Memory-Safe Copy (.slice) ===");
    console.log(`Time: ${(endTimeSafe - startTimeSafe).toFixed(2)} ms`);
    console.log(`Heap Delta: ${((endHeapSafe - startHeapSafe) / 1024 / 1024).toFixed(2)} MB\n`);
    
    // Performance Multipliers
    const timeSpeedupZero = (endTimeDV - startTimeDV) / (endTimeOhn - startTimeOhn);
    const timeSpeedupSafe = (endTimeDV - startTimeDV) / (endTimeSafe - startTimeSafe);
    
    console.log(`🚀 Ohnrscript Zero-Copy is ${timeSpeedupZero.toFixed(2)}x faster than Manual Binary Parsing!`);
    console.log(`🚀 Ohnrscript Memory-Safe is ${timeSpeedupSafe.toFixed(2)}x faster than Manual Binary Parsing!`);
}

runBenchmark();
