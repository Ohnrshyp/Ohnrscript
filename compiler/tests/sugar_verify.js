#!/usr/bin/env node
// compiler/tests/sugar_verify.js
// Verifies all 5 Level 1 sugar features by loading the source .ohn
// parser/lexer directly (not the bootstrap stage2).
//
// Usage: node compiler/tests/sugar_verify.js

'use strict';

const fs   = require('fs');
const path = require('path');

// Load the source .ohn files directly (Node.js can require them)
const parser    = require('../src/frontend/parser.ohn');
const generator = require('../src/codegen/generator.ohn');

const pool = parser.get_intern_pool();

// Helper: read a null-terminated string from the intern pool
function read_intern(offset) {
    let end = offset;
    while (pool[end] !== 0) end++;
    return Buffer.from(pool.slice(offset, end)).toString('utf-8');
}

// ============================================================
// Parse the sugar test file
// ============================================================
const testFile = path.join(__dirname, 'sugar_test.ohn');
const raw      = fs.readFileSync(testFile);
const source   = new Uint8Array(raw);

console.log('=== Ohnrscript Level 1 Sugar Verification ===');
console.log('Input: ' + testFile);
console.log('');

let pass_count = 0;
let fail_count = 0;

function assert_eq(label, actual, expected) {
    if (actual === expected) {
        console.log('  ✓ ' + label + ' = ' + actual);
        pass_count++;
    } else {
        console.log('  ✗ ' + label + ' = ' + actual + ' (expected ' + expected + ')');
        fail_count++;
    }
}

// Parse
const rootIndex = parser.parse(source);
const nodes     = parser.get_ast_nodes();
const extra     = parser.get_ast_extra();

// Walk the AST and collect all top-level variable declarations
// Each declaration is: NODE_VARIABLE_DECLARATION → NODE_VARIABLE_DECLARATOR → (name, init)
const rootTF     = nodes[rootIndex];
const childCount = nodes[rootIndex + 2];
const extraStart = nodes[rootIndex + 3];

const vars = {};

for (let i = 0; i < childCount; i++) {
    const stmtIdx = extra[extraStart + i];
    const stmtTF  = nodes[stmtIdx];
    const stmtBase = stmtTF & 0xFF;

    if (stmtBase === parser.NODE_VARIABLE_DECLARATION) {
        const declCount  = nodes[stmtIdx + 2];
        const declExtra  = nodes[stmtIdx + 3];

        for (let j = 0; j < declCount; j++) {
            const declIdx = extra[declExtra + j];
            const nameIdx = nodes[declIdx + 2];
            const initIdx = nodes[declIdx + 3];

            // Get the variable name
            const nameOff = nodes[nameIdx + 2];
            const name    = read_intern(nameOff);

            // Get the init value
            if (initIdx >= 0) {
                const initTF   = nodes[initIdx];
                const initBase = initTF & 0xFF;

                if (initBase === parser.NODE_LITERAL && (initTF & parser.FLAG_NUMBER)) {
                    vars[name] = nodes[initIdx + 2]; // data_1 = numeric value
                } else if (initBase === parser.NODE_CALL_EXPRESSION) {
                    // Could be an __extern call
                    const calleeIdx = nodes[initIdx + 2];
                    const calleeOff = nodes[calleeIdx + 2];
                    const calleeName = read_intern(calleeOff);
                    vars[name] = '__extern_call:' + calleeName;
                } else if (initBase === parser.NODE_NEW_EXPRESSION) {
                    const calleeIdx  = nodes[initIdx + 2];
                    const calleeOff  = nodes[calleeIdx + 2];
                    const calleeName = read_intern(calleeOff);
                    vars[name] = 'new:' + calleeName;
                }
            }
        }
    }
}

// ============================================================
// Test 1: Integer-Cast String Literals (#'...')
// ============================================================
console.log('--- Test 1: Integer-Cast String Literals ---');

// 'GET ' = G(0x47) E(0x45) T(0x54) ' '(0x20) → LE: 0x20544547 = 542393671
assert_eq("METHOD_GET  = #'GET '", vars['METHOD_GET'],  0x20544547 | 0);

// 'POST' = P(0x50) O(0x4F) S(0x53) T(0x54) → LE: 0x54534F50 = 1414745936
assert_eq("METHOD_POST = #'POST'", vars['METHOD_POST'], 0x54534F50 | 0);

// 'PUT ' = P(0x50) U(0x55) T(0x54) ' '(0x20) → LE: 0x20545550 = 541872464
assert_eq("METHOD_PUT  = #'PUT '", vars['METHOD_PUT'],  0x20545550 | 0);

// 'OK' = O(0x4F) K(0x4B) → LE (zero-pad): 0x00004B4F = 19279
assert_eq("METHOD_OK   = #'OK'",   vars['METHOD_OK'],   0x00004B4F | 0);

// 'X' = X(0x58) → LE (zero-pad): 0x00000058 = 88
assert_eq("METHOD_X    = #'X'",    vars['METHOD_X'],    0x00000058 | 0);

console.log('');

// ============================================================
// Test 2: Byte Character Literals (ch'...')
// ============================================================
console.log('--- Test 2: Byte Character Literals ---');
assert_eq("CR         = ch'\\r'",    vars['CR'],         13);
assert_eq("LF         = ch'\\n'",    vars['LF'],         10);
assert_eq("SP         = ch' '",     vars['SP'],         32);
assert_eq("TAB        = ch'\\t'",    vars['TAB'],         9);
assert_eq("NULL_BYTE  = ch'\\0'",    vars['NULL_BYTE'],   0);
assert_eq("LETTER_A   = ch'A'",     vars['LETTER_A'],   65);
assert_eq("SLASH      = ch'/'",     vars['SLASH'],      47);
assert_eq("BACKSLASH  = ch'\\\\'",   vars['BACKSLASH'],  92);
console.log('');

// ============================================================
// Test 3: Fixed-Point Literals (Nfp)
// ============================================================
console.log('--- Test 3: Fixed-Point Literals ---');
assert_eq("three      = 3.0fp",    vars['three'],      192);   // 3 × 64
assert_eq("half       = 0.5fp",    vars['half'],        32);   // 0.5 × 64
assert_eq("quarter    = 0.25fp",   vars['quarter'],     16);   // 0.25 × 64
assert_eq("one        = 1.0fp",    vars['one'],         64);   // 1 × 64
assert_eq("zero       = 0.0fp",    vars['zero'],         0);   // 0 × 64
console.log('');

// ============================================================
// Test 4: Extern Declarations
// ============================================================
console.log('--- Test 4: Extern Declarations ---');
assert_eq("sys_kqueue_create    = extern (simple)",
    vars['sys_kqueue_create'], '__extern_call:__extern');
assert_eq("ohn_socket_accept    = extern (aliased)",
    vars['ohn_socket_accept'], '__extern_call:__extern');
console.log('');

// ============================================================
// Test 5: Slots Declarations
// ============================================================
console.log('--- Test 5: Slots Declarations ---');
assert_eq("fd_table             = slots (new Int32Array)",
    vars['fd_table'], 'new:Int32Array');
assert_eq("state_table          = slots (new Int32Array)",
    vars['state_table'], 'new:Int32Array');
assert_eq("bytes_read           = slots (new Int32Array)",
    vars['bytes_read'], 'new:Int32Array');
assert_eq("response_buffer      = slots (new Int32Array)",
    vars['response_buffer'], 'new:Int32Array');
console.log('');

// ============================================================
// Summary
// ============================================================
console.log('=== Results: ' + pass_count + ' passed, ' + fail_count + ' failed ===');
if (fail_count > 0) {
    process.exit(1);
}

// ============================================================
// Bonus: Generate JS output and display
// ============================================================
console.log('');
console.log('--- Generated JS Output (V8 target) ---');
const outFile = path.join(__dirname, 'sugar_test_output.js');
generator.generate(
    parser.get_ast_nodes(),
    parser.get_ast_extra(),
    parser.get_intern_pool(),
    rootIndex,
    outFile
);
const jsOutput = fs.readFileSync(outFile, 'utf-8');
console.log(jsOutput);
