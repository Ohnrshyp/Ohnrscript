const assert = require('assert');
const { getCookie } = require('./ohn-cookie');

const dummyHeader = "analytic_1=a; analytic_2=b; analytic_3=c; target_cookie=secret123; analytic_4=d; analytic_5=e; analytic_6=f; empty_cookie=; analytic_7=g; analytic_8=h";
const headerBuf = Buffer.from(dummyHeader);

console.log("Raw Cookie Buffer:", dummyHeader);
console.log("---");

// Test 1: Extracting an existing cookie
const targetValue = getCookie(headerBuf, "target_cookie");
console.log("Extracted target_cookie:", targetValue);
assert.strictEqual(targetValue, "secret123", "Should extract the exact target cookie value");

// Test 2: Extracting a missing cookie
const missingValue = getCookie(headerBuf, "does_not_exist");
console.log("Extracted does_not_exist:", missingValue);
assert.strictEqual(missingValue, null, "Should return null for missing cookies");

// Test 3: Extracting an empty cookie
const emptyValue = getCookie(headerBuf, "empty_cookie");
console.log("Extracted empty_cookie:", emptyValue);
assert.strictEqual(emptyValue, "", "Should return empty string for cookies with no value");

// Test 4: Extracting first and last cookies
const firstValue = getCookie(headerBuf, "analytic_1");
console.log("Extracted analytic_1:", firstValue);
assert.strictEqual(firstValue, "a", "Should extract the first cookie");

const lastValue = getCookie(headerBuf, "analytic_8");
console.log("Extracted analytic_8:", lastValue);
assert.strictEqual(lastValue, "h", "Should extract the last cookie");

console.log("✅ All getCookie assertions passed!");
