// compiler/tests/self_parse_test.js
// Test that the parser can parse all compiler source files
// This is the critical Phase 2.5 verification

'use strict';

const fs = require('fs');
const path = require('path');
const parser = require('../src/frontend/parser.ohn');

const COMPILER_FILES = [
    '../src/frontend/lexer.ohn',
    '../src/frontend/parser.ohn',
    '../src/core/arena.ohn',
    '../src/codegen/emitter.ohn',
    '../src/codegen/generator.ohn',
];

console.log('=== Self-Parse Verification Test ===');
console.log('');

let all_passed = true;

for (let f = 0; f < COMPILER_FILES.length; f++) {
    const rel = COMPILER_FILES[f];
    const abs = path.resolve(__dirname, rel);
    const name = path.basename(abs);

    process.stdout.write('Parsing ' + name + '... ');

    try {
        const raw = fs.readFileSync(abs);
        const sourceBuffer = new Uint8Array(raw);

        const rootIndex = parser.parse(sourceBuffer);
        const nodes = parser.get_ast_nodes();
        const root_type = nodes[rootIndex] & 0xFF;

        if (root_type !== 0x00) {
            console.log('FAIL — root node is not Program (got 0x' + root_type.toString(16) + ')');
            all_passed = false;
            continue;
        }

        const child_count = nodes[rootIndex + 2];
        const ast_slots = parser.get_ast_cursor();
        const extra_used = parser.get_extra_cursor();
        const intern_used = parser.get_intern_cursor();

        console.log('OK (' + (ast_slots / 4) + ' nodes, ' +
                    extra_used + ' extra, ' +
                    intern_used + ' intern bytes, ' +
                    child_count + ' top-level statements)');
    } catch (err) {
        console.log('FAIL — ' + err.message);
        all_passed = false;
    }
}

console.log('');
if (all_passed) {
    console.log('✓ ALL COMPILER FILES PARSED SUCCESSFULLY');
    console.log('  The parser can read its own source code.');
} else {
    console.log('✗ SOME FILES FAILED TO PARSE');
    process.exit(1);
}
