const { mapVector } = require('./ohn-vector');

// Create a Float32Array with 10 random floats
const originalFloats = new Float32Array(10);
for (let i = 0; i < 10; i++) {
    originalFloats[i] = Math.random();
}

// Write them to a Node.js Buffer to simulate receiving a raw binary buffer from a DB
const rawBuffer = Buffer.allocUnsafe(40);
for (let i = 0; i < 10; i++) {
    rawBuffer.writeFloatLE(originalFloats[i], i * 4);
}

console.log('Original floats (first 3):', originalFloats.subarray(0, 3));
console.log('Raw buffer size:', rawBuffer.length);

// 1. Map the buffer to a Float32Array
const mappedView = mapVector(rawBuffer);

console.log('Mapped view (first 3):', mappedView.subarray(0, 3));

// 2. Assert the values match exactly
let matches = true;
for (let i = 0; i < 10; i++) {
    if (mappedView[i] !== originalFloats[i]) {
        matches = false;
        console.error(`Mismatch at index ${i}: expected ${originalFloats[i]}, got ${mappedView[i]}`);
    }
}
console.log(`Assertion 1 (Initial values match): ${matches ? 'PASS' : 'FAIL'}`);

// 3. Mutate the returned array and verify it mutates the original buffer
mappedView[0] = 42.42;

// Check if the underlying buffer was mutated
const mutatedBufferValue = rawBuffer.readFloatLE(0);
console.log(`Buffer's first float after mutation: ${mutatedBufferValue}`);
console.log(`Assertion 2 (Zero-copy mutation): ${mutatedBufferValue === mappedView[0] ? 'PASS' : 'FAIL'}`);

if (!matches || mutatedBufferValue !== mappedView[0]) {
    process.exit(1);
}
