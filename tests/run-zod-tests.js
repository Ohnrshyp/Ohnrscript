const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const cborPlugin = require('../src/plugins/babel-plugin-cbor-aot');
const assert = require('assert');

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

const targetFile = path.join(__dirname, 'ohn-zod.test.ohn');
const outputCode = transpileFile(targetFile);

console.log("Transpiled output code:\n", outputCode);

const UserPayload = eval(`
  (function() {
    var module = { exports: {} };
    ${outputCode}
    return module.exports;
  })();
`);

console.log("Transpiled code successfully evaluated.");

// 1. Valid Payload
const validObj = new UserPayload();
validObj.age = 500;
validObj.name = "John Doe";
const validBuf = validObj.toCBOR();

console.log("Testing valid payload...");
const parsedValid = UserPayload.fromCBOR(validBuf);
assert.strictEqual(parsedValid.age, 500);
assert.strictEqual(parsedValid.name, "John Doe");
console.log("Valid payload passed!");

// 2. Invalid UInt32
const invalidAgeObj = new UserPayload();
invalidAgeObj.age = 5000;
invalidAgeObj.name = "John Doe";
const invalidAgeBuf = invalidAgeObj.toCBOR();

console.log("Testing invalid UInt32...");
let caughtAge = false;
try {
  UserPayload.fromCBOR(invalidAgeBuf);
} catch (e) {
  assert(e.message.includes('Validation Error: boundary check failed for age'), 'Expected specific error message for age');
  caughtAge = true;
}
assert(caughtAge, 'Expected fromCBOR to throw on invalid age');
console.log("Invalid UInt32 passed!");

// 3. Invalid String
const invalidNameObj = new UserPayload();
invalidNameObj.age = 500;
invalidNameObj.name = "This string is definitely more than sixteen characters long";
const invalidNameBuf = invalidNameObj.toCBOR();

console.log("Testing invalid String...");
let caughtName = false;
try {
  UserPayload.fromCBOR(invalidNameBuf);
} catch (e) {
  assert(e.message.includes('Validation Error: string length exceeds max for name'), 'Expected specific error message for name: ' + e.message);
  caughtName = true;
}
assert(caughtName, 'Expected fromCBOR to throw on invalid name');
console.log("Invalid String passed!");

console.log("All Zod validation tests passed successfully!");
