const assert = require('assert');
const { buffer, fillEntropy } = require('../src/ohn-uuid');

console.log('Running UUID v4 entropy math tests...');

let successCount = 0;

for (let i = 0; i < 100; i++) {
  fillEntropy();
  
  // Verify Version 4: The 4 most significant bits of buffer[6] must be 0100 (which is 4)
  const version = buffer[6] >> 4;
  
  // Verify Variant 1: The 2 most significant bits of buffer[8] must be 10 (which is 2)
  const variant = buffer[8] >> 6;
  
  assert.strictEqual(version, 4, `Iteration ${i}: Expected version 4, got ${version}`);
  assert.strictEqual(variant, 2, `Iteration ${i}: Expected variant 2, got ${variant}`);
  
  successCount++;
}

console.log(`Successfully completed ${successCount} iterations. UUID v4 bitwise math is perfect.`);
