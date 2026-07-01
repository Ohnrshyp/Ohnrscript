// compiler/tests/parser.test.js
// End-to-end test: raw UTF-8 source -> Lexer -> Parser -> verify AST arenas
// Run with: node --expose-gc compiler/tests/parser.test.js

'use strict';

const parser = require('../src/frontend/parser.ohn');
const lexer = require('../src/frontend/lexer.ohn');

// ============================================================
// Test Source Code — raw UTF-8 bytes
// ============================================================
const TEST_SOURCE = 'const message = "Ohnrscript DOD Compiler"; console.log(message);';
const sourceBuffer = new Uint8Array(Buffer.from(TEST_SOURCE, 'utf-8'));

console.log('=== Ohnrscript Zero-Allocation Parser Test ===');
console.log('Source: ' + TEST_SOURCE);
console.log('Source bytes: ' + sourceBuffer.length);
console.log('');

// ============================================================
// Test 1: Correctness — Parse and verify AST structure
// ============================================================
console.log('--- Test 1: AST Correctness ---');

const rootIndex = parser.parse(sourceBuffer);

const nodes = parser.get_ast_nodes();
const extra = parser.get_ast_extra();
const pool  = parser.get_intern_pool();

// Helper: read a null-terminated string from the intern pool
function read_intern(offset) {
    let end = offset;
    while (pool[end] !== 0) end++;
    return Buffer.from(pool.slice(offset, end)).toString('utf-8');
}

// Helper: decode node type name
function type_name(type_and_flags) {
    const base = type_and_flags & 0xFF;
    switch (base) {
        case 0x00: return 'Program';
        case 0x01: return 'VariableDeclaration';
        case 0x02: return 'VariableDeclarator';
        case 0x03: return 'Identifier';
        case 0x04: return 'Literal';
        case 0x05: return 'CallExpression';
        case 0x06: return 'ExpressionStatement';
        case 0x07: return 'MemberExpression';
        default:   return 'Unknown(0x' + base.toString(16) + ')';
    }
}

// Walk and print the AST
function dump_node(idx, indent) {
    indent = indent || '';
    const tf = nodes[idx];
    const sl = nodes[idx + 1];
    const d1 = nodes[idx + 2];
    const d2 = nodes[idx + 3];
    const base = tf & 0xFF;
    const flags_str = [];

    if (base === 0x01) {
        if (tf & 0x0100) flags_str.push('const');
        if (tf & 0x0200) flags_str.push('let');
        if (tf & 0x0400) flags_str.push('var');
    }
    if (base === 0x04) {
        if (tf & 0x0100) flags_str.push('string');
        if (tf & 0x0200) flags_str.push('number');
    }

    let extra_info = '';
    if (base === 0x03) { // Identifier
        extra_info = ' name="' + read_intern(d1) + '"';
    }
    if (base === 0x04 && (tf & 0x0100)) { // String Literal
        extra_info = ' value="' + read_intern(d1) + '"';
    }
    if (base === 0x04 && (tf & 0x0200)) { // Number Literal
        extra_info = ' value=' + d1;
    }

    const flags_display = flags_str.length > 0 ? ' [' + flags_str.join(', ') + ']' : '';
    console.log(indent + type_name(tf) + flags_display + extra_info +
                ' (slot=' + idx + ', src=' + sl + ', d1=' + d1 + ', d2=' + d2 + ')');

    // Recurse into children based on node type
    if (base === 0x00 || base === 0x01) {
        // Program / VariableDeclaration: d1=count, d2=extra_start
        const count = d1;
        const start = d2;
        for (let i = 0; i < count; i++) {
            dump_node(extra[start + i], indent + '  ');
        }
    }
    if (base === 0x02) {
        // VariableDeclarator: d1=LHS, d2=RHS
        dump_node(d1, indent + '  ');
        dump_node(d2, indent + '  ');
    }
    if (base === 0x06) {
        // ExpressionStatement: d1=expression
        dump_node(d1, indent + '  ');
    }
    if (base === 0x05) {
        // CallExpression: d1=callee, d2=extra_start, arg_count in bits 16-31
        const arg_count = (tf >> 16) & 0xFFFF;
        dump_node(d1, indent + '  ');
        for (let i = 0; i < arg_count; i++) {
            dump_node(extra[d2 + i], indent + '  ');
        }
    }
    if (base === 0x07) {
        // MemberExpression: d1=object, d2=property
        dump_node(d1, indent + '  ');
        dump_node(d2, indent + '  ');
    }
}

dump_node(rootIndex, '');

console.log('');
console.log('AST Nodes used: ' + (parser.get_ast_cursor() / 4) + ' nodes (' + parser.get_ast_cursor() + ' Int32 slots)');
console.log('AST Extra used: ' + parser.get_extra_cursor() + ' entries');
console.log('Intern Pool used: ' + parser.get_intern_cursor() + ' bytes');

// ============================================================
// Test 2: Verify specific AST expectations
// ============================================================
console.log('');
console.log('--- Test 2: Structural Assertions ---');

// Root must be Program
const root_type = nodes[rootIndex] & 0xFF;
console.assert(root_type === 0x00, 'Root node must be Program');
console.log('✓ Root node is Program');

// Program has 2 children (VariableDeclaration + ExpressionStatement)
const program_child_count = nodes[rootIndex + 2];
console.assert(program_child_count === 2, 'Program must have 2 children, got ' + program_child_count);
console.log('✓ Program has 2 children');

// First child is VariableDeclaration with const flag
const first_child_idx = extra[nodes[rootIndex + 3]];
const first_child_type = nodes[first_child_idx] & 0xFF;
const first_child_flag = nodes[first_child_idx] & 0x0100;
console.assert(first_child_type === 0x01, 'First child must be VariableDeclaration');
console.assert(first_child_flag === 0x0100, 'First child must have const flag');
console.log('✓ First child is const VariableDeclaration');

// Second child is ExpressionStatement
const second_child_idx = extra[nodes[rootIndex + 3] + 1];
const second_child_type = nodes[second_child_idx] & 0xFF;
console.assert(second_child_type === 0x06, 'Second child must be ExpressionStatement');
console.log('✓ Second child is ExpressionStatement');

// Verify "message" identifier is interned
const declarator_idx = extra[nodes[first_child_idx + 3]]; // first declarator
const id_node_idx = nodes[declarator_idx + 2]; // data_1 = LHS Identifier
const id_intern_offset = nodes[id_node_idx + 2]; // data_1 = intern pool offset
const id_name = read_intern(id_intern_offset);
console.assert(id_name === 'message', 'Identifier must be "message", got "' + id_name + '"');
console.log('✓ Identifier "message" correctly interned');

// Verify string literal
const literal_idx = nodes[declarator_idx + 3]; // data_2 = RHS Literal
const lit_type = nodes[literal_idx] & 0xFF;
const lit_flag = nodes[literal_idx] & 0x0100;
console.assert(lit_type === 0x04, 'RHS must be Literal');
console.assert(lit_flag === 0x0100, 'RHS Literal must have string flag');
const lit_intern = nodes[literal_idx + 2]; // data_1
const lit_value = read_intern(lit_intern);
console.assert(lit_value === 'Ohnrscript DOD Compiler', 'String value must match');
console.log('✓ String literal "Ohnrscript DOD Compiler" correctly interned and unescaped');

console.log('');

// ============================================================
// Test 3: Zero-Allocation GC Benchmark
// ============================================================
console.log('--- Test 3: Zero-Allocation GC Benchmark ---');

if (typeof global.gc === 'function') {
    // JIT Warmup: let V8 TurboFan compile all hot functions before measuring
    const WARMUP = 5000;
    for (let i = 0; i < WARMUP; i++) {
        parser.parse(sourceBuffer);
    }

    global.gc();
    const heapBefore = process.memoryUsage().heapUsed;

    const ITERATIONS = 100000;
    for (let i = 0; i < ITERATIONS; i++) {
        parser.parse(sourceBuffer);
    }

    global.gc();
    const heapAfter = process.memoryUsage().heapUsed;
    const heapDelta = heapAfter - heapBefore;

    console.log('JIT Warmup:  ' + WARMUP + ' iterations');
    console.log('Iterations:  ' + ITERATIONS);
    console.log('Heap Before: ' + (heapBefore / 1024).toFixed(2) + ' KB');
    console.log('Heap After:  ' + (heapAfter / 1024).toFixed(2) + ' KB');
    console.log('Heap Delta:  ' + (heapDelta / 1024).toFixed(2) + ' KB');
    console.log('Per-iteration: ' + (heapDelta / ITERATIONS).toFixed(4) + ' bytes');
    console.log('');

    if (Math.abs(heapDelta) < 100 * 1024) {
        console.log('✓ PASS: Zero-allocation property VERIFIED. Heap delta < 100KB over ' + ITERATIONS + ' iterations.');
    } else {
        console.log('✗ FAIL: Heap delta ' + (heapDelta / 1024).toFixed(2) + ' KB exceeds 100KB threshold.');
    }
} else {
    console.log('SKIP: Run with --expose-gc to enable GC benchmark.');
    console.log('Usage: node --expose-gc compiler/tests/parser.test.js');
}

console.log('');
console.log('=== All tests complete ===');
