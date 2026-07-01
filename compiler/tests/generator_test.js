// compiler/tests/generator_test.js
// Test: Parse a .ohn file then generate .js output
// Verifies the round-trip: source -> parse -> generate -> valid JS

'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('../src/frontend/parser.ohn');
const { generate } = require('../src/codegen/generator.ohn');

const test_source = `const message = "Hello World";
const x = 42;
console.log(message);

function add(a, b) {
    return a + b;
}

if (x > 10) {
    console.log("big");
} else {
    console.log("small");
}

const result = add(x, 5);
`;

const outputFile = path.resolve(__dirname, '../../.tmp_gen_test.js');

console.log('=== Generator Round-Trip Test ===');
console.log('');

// Parse
const sourceBuffer = new Uint8Array(Buffer.from(test_source, 'utf-8'));
const rootIndex = parser.parse(sourceBuffer);

console.log('Parsed: ' + (parser.get_ast_cursor() / 4) + ' AST nodes');

// Generate
generate(
    parser.get_ast_nodes(),
    parser.get_ast_extra(),
    parser.get_intern_pool(),
    rootIndex,
    outputFile
);

// Read and display the output
const output = fs.readFileSync(outputFile, 'utf-8');
console.log('');
console.log('--- Generated Output ---');
console.log(output);

// Try to execute the output to verify it's valid JS
console.log('--- Execution Test ---');
try {
    // Use Function constructor to execute in isolation
    const fn = new Function(output);
    fn();
    console.log('✓ Generated code executed successfully');
} catch (err) {
    console.log('✗ Execution failed: ' + err.message);
}

// Cleanup
fs.unlinkSync(outputFile);

console.log('');
console.log('=== Generator test complete ===');
