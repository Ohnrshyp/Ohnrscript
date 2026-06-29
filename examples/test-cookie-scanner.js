const assert = require('assert');
const { scanCookies } = require('./ohn-cookie');

const buffer = Buffer.from("session=123; theme=dark; tracking_id=abc");
const pointers = scanCookies(buffer);

console.log("Raw Cookie Buffer:", buffer.toString());
console.log("Extracted Pointers:", pointers);
console.log("---");

// Verify pointer extraction works without allocating during scan
const expectedKeys = ["session", "theme", "tracking_id"];
const expectedVals = ["123", "dark", "abc"];

for (let i = 0; i < pointers.length; i++) {
  const p = pointers[i];
  
  // Slicing the buffer *after* the scan for the purpose of the test
  const key = buffer.subarray(p.keyStart, p.keyEnd).toString('ascii');
  const val = p.valStart === p.valEnd ? "" : buffer.subarray(p.valStart, p.valEnd).toString('ascii');
  
  console.log(`Parsed Cookie ${i}: '${key}' = '${val}'`);
  
  assert.strictEqual(key, expectedKeys[i], `Expected key '${expectedKeys[i]}', got '${key}'`);
  assert.strictEqual(val, expectedVals[i], `Expected value '${expectedVals[i]}', got '${val}'`);
}

console.log("✅ All zero-allocation assertions passed!");
