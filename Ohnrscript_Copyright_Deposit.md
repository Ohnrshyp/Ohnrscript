# Copyright Deposit: Ohnrscript
**Author:** Jordan Kugler
**Year of Completion:** 2026

This document contains identifying portions of the source code for Ohnrscript, demonstrating its novel Ahead-Of-Time (AOT) compilation architecture, zero-allocation parser, and its capacity to compile JavaScript syntax directly to LLVM Intermediate Representation (IR) and bare-metal executable machine code.

---

## File: compiler/src/core/arena.ohn

```javascript
// compiler/src/core/arena.ohn

const ARENA_SIZE = 16 * 1024 * 1024; // 16 MB
const HASHTABLE_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_ENTRIES = (HASHTABLE_SIZE / 16) | 0; // 524,288 slots
const LOAD_FACTOR_LIMIT = (MAX_ENTRIES * 0.7) | 0;

const arenaPool = [];

class ScopeArena {
    constructor(parent = null) {
        this.buffer = new ArrayBuffer(ARENA_SIZE);
        // Map Int32Array strictly to avoid SMI traps and HeapNumber allocations
        this.u32 = new Int32Array(this.buffer, 0, HASHTABLE_SIZE / 4);
        this.u8 = new Uint8Array(this.buffer, HASHTABLE_SIZE, ARENA_SIZE - HASHTABLE_SIZE);
        this.parent = parent;
        this.reset();
    }

    reset() {
        // Zero-allocation reset (no GC destruction)
        this.u32.fill(0);
        this.string_cursor = 1; // start at 1 so key_offset=0 means empty slot
        this.occupied_count = 0;
    }
}

function allocateScope(parent = null) {
    if (arenaPool.length > 0) {
        const arena = arenaPool.pop();
        arena.parent = parent;
        arena.reset();
        return arena;
    }
    return new ScopeArena(parent);
}

function freeScope(arena) {
    arena.parent = null;
    arenaPool.push(arena);
}

// SMI-Safe Hash utilizing Math.imul
function fnv1a(sourceBuffer, offset, length) {
    let hash = 2166136261 | 0;
    const end = (offset + length) | 0;
    for (let i = offset | 0; i < end; i = (i + 1) | 0) {
        hash = (hash ^ sourceBuffer[i]) | 0;
        hash = Math.imul(hash, 16777619) | 0;
    }
    return hash | 0; // strictly signed 32-bit SMI
}

// Zero-allocation manual byte match
function compareStrings(arenaU8, internOffset, sourceBuffer, sourceOffset, sourceLength) {
    internOffset = internOffset | 0;
    sourceOffset = sourceOffset | 0;
    sourceLength = sourceLength | 0;
    
    // Validate null terminator matches length
    if (arenaU8[(internOffset + sourceLength) | 0] !== 0) {
        return false;
    }
    
    // Exact byte-by-byte match
    for (let i = 0; i < sourceLength; i = (i + 1) | 0) {
        if (arenaU8[(internOffset + i) | 0] !== sourceBuffer[(sourceOffset + i) | 0]) {
            return false;
        }
    }
    return true;
}

// Open Addressing Linear Probe
function probe(arena, sourceBuffer, sourceOffset, sourceLength, hash) {
    // Wrap to fit within MAX_ENTRIES using bitwise modulo trick since it's a power of 2, 
    // or standard JS modulo if we just want safety. Using standard JS modulo with bitwise unsigned shift.
    let index = (hash >>> 0) % MAX_ENTRIES; 
    index = index | 0;
    
    const u32 = arena.u32;
    const u8 = arena.u8;
    
    while (true) {
        const structBase = (index * 4) | 0;
        const key_offset = u32[structBase] | 0;
        
        // Empty slot found
        if (key_offset === 0) {
            return index | 0; 
        }
        
        // Collision or Match?
        const slot_hash = u32[(structBase + 1) | 0] | 0;
        if (slot_hash === hash) {
            if (compareStrings(u8, key_offset, sourceBuffer, sourceOffset, sourceLength)) {
                return index | 0; // Exact match found
            }
        }
        
        // Linear probe next slot
        index = (index + 1) % MAX_ENTRIES;
        index = index | 0;
    }
}

function insertSymbol(arena, sourceBuffer, sourceOffset, sourceLength, symbolFlags, nodeRef) {
    sourceOffset = sourceOffset | 0;
    sourceLength = sourceLength | 0;
    symbolFlags = symbolFlags | 0;
    nodeRef = nodeRef | 0;
    
    if (arena.occupied_count >= LOAD_FACTOR_LIMIT) {
        throw new Error("Arena Capacity Exceeded (Needs 32MB Rehashing)");
    }
    
    const hash = fnv1a(sourceBuffer, sourceOffset, sourceLength);
    const index = probe(arena, sourceBuffer, sourceOffset, sourceLength, hash);
    
    const structBase = (index * 4) | 0;
    const u32 = arena.u32;
    
    // Check if empty
    if (u32[structBase] === 0) {
        // We need to intern the string
        const internOffset = arena.string_cursor | 0;
        
        const u8 = arena.u8;
        for (let i = 0; i < sourceLength; i = (i + 1) | 0) {
            u8[(internOffset + i) | 0] = sourceBuffer[(sourceOffset + i) | 0];
        }
        // Null terminator
        u8[(internOffset + sourceLength) | 0] = 0;
        
        // Advance cursor
        arena.string_cursor = (internOffset + sourceLength + 1) | 0;
        
        // Write struct (16-bytes mapped across 4 Int32s)
        u32[structBase] = internOffset | 0;
        u32[(structBase + 1) | 0] = hash | 0;
        u32[(structBase + 2) | 0] = symbolFlags | 0;
        u32[(structBase + 3) | 0] = nodeRef | 0;
        
        arena.occupied_count = (arena.occupied_count + 1) | 0;
    } else {
        // Overwriting existing symbol in current scope
        u32[(structBase + 2) | 0] = symbolFlags | 0;
        u32[(structBase + 3) | 0] = nodeRef | 0;
    }
    
    return nodeRef | 0;
}

// Lexical Scope Traversal
function lookupSymbol(arena, sourceBuffer, sourceOffset, sourceLength, hash) {
    // If hash not provided, calculate it once
    if (hash === undefined) {
        hash = fnv1a(sourceBuffer, sourceOffset, sourceLength);
    }
    hash = hash | 0;
    
    let currentArena = arena;
    while (currentArena !== null) {
        const index = probe(currentArena, sourceBuffer, sourceOffset, sourceLength, hash);
        const structBase = (index * 4) | 0;
        
        // If not empty, we found it!
        if (currentArena.u32[structBase] !== 0) {
            return currentArena.u32[(structBase + 3) | 0] | 0;
        }
        
        // Cache miss in this scope, traverse up the lexical chain
        currentArena = currentArena.parent;
    }
    
    // Not found in any scope
    return -1;
}

module.exports = {
    allocateScope,
    freeScope,
    insertSymbol,
    lookupSymbol,
    fnv1a
};
```

## File: compiler/src/frontend/parser.ohn

```javascript
// compiler/src/frontend/parser.ohn
// Zero-Allocation DOD Pratt Parser for the Ohnrscript Self-Hosted Compiler
// Manages 4 memory arenas: Main AST, AST Extra, Intern Pool, Symbol Table
// No wrapper classes, no helper objects, no dynamic arrays.
// All arithmetic is SMI-safe (suffixed with | 0).

'use strict';

const lexer = require('./lexer.ohn');
const arena = require('../core/arena.ohn');

// ============================================================
// AST Node Type Enums (Bits 0-7)
// ============================================================
const NODE_PROGRAM              = 0x00;
const NODE_VARIABLE_DECLARATION = 0x01;
const NODE_VARIABLE_DECLARATOR  = 0x02;
const NODE_IDENTIFIER           = 0x03;
const NODE_LITERAL              = 0x04;
const NODE_CALL_EXPRESSION      = 0x05;
const NODE_EXPRESSION_STATEMENT = 0x06;
const NODE_MEMBER_EXPRESSION    = 0x07;
const NODE_FUNCTION_DECLARATION = 0x08;
const NODE_IF_STATEMENT         = 0x09;
const NODE_WHILE_STATEMENT      = 0x0A;
const NODE_RETURN_STATEMENT     = 0x0B;
const NODE_BINARY_EXPRESSION    = 0x0C;
const NODE_BLOCK_STATEMENT      = 0x0D;
const NODE_ARRAY_EXPRESSION     = 0x0E;
const NODE_UNARY_EXPRESSION     = 0x0F;
const NODE_NEW_EXPRESSION       = 0x10;
const NODE_THROW_STATEMENT      = 0x11;
const NODE_BREAK_STATEMENT      = 0x12;
const NODE_CONTINUE_STATEMENT   = 0x13;
const NODE_FOR_STATEMENT        = 0x14;
const NODE_ASSIGNMENT_EXPRESSION = 0x15;
const NODE_UPDATE_EXPRESSION    = 0x16;
const NODE_OBJECT_EXPRESSION    = 0x17;
const NODE_PROPERTY             = 0x18;
const NODE_CLASS_DECLARATION    = 0x19;
const NODE_METHOD_DEFINITION    = 0x1A;
const NODE_THIS_EXPRESSION      = 0x1B;
const NODE_CONDITIONAL_EXPRESSION = 0x1C;

// ============================================================
// Modifier Flags (Bits 8-31) — OR'd with base type
// ============================================================
// VariableDeclaration kind flags
const FLAG_CONST    = 0x0100;
const FLAG_LET      = 0x0200;
const FLAG_VAR      = 0x0400;

// Literal type flags
const FLAG_STRING   = 0x0100;
const FLAG_NUMBER   = 0x0200;
const FLAG_BOOLEAN  = 0x0400;
const FLAG_NULL     = 0x0800;
const FLAG_UNDEFINED = 0x1000;

// MemberExpression flags
const FLAG_COMPUTED = 0x0100;

// UnaryExpression / UpdateExpression: operator stored in bits 8-15
// Binary/Assignment operator token stored in bits 16-31 of type_and_flags
// For BinaryExpression: operator token in bits 16-31
// For AssignmentExpression: operator token in bits 16-31

// UpdateExpression: prefix flag
const FLAG_PREFIX   = 0x0100;

// LLVM IR backend: typed array element type flag
// Bit 13 — unused by all other flag sets above.
// Set on NewExpression when callee is Float32Array.
// Propagated to computed MemberExpression when object carries this flag.
const FLAG_FLOAT    = 0x2000;

// ============================================================
// 16-Byte AST Node Struct Layout (4 x Int32)
// ============================================================
// Offset 0x00: type_and_flags
// Offset 0x04: source_location (byte offset into raw source buffer)
// Offset 0x08: data_1 (primary: symbol offset, LHS pointer, child count)
// Offset 0x0C: data_2 (secondary: RHS pointer, ast_extra offset)
const SLOT_TYPE_FLAGS = 0;
const SLOT_SOURCE_LOC = 1;
const SLOT_DATA_1     = 2;
const SLOT_DATA_2     = 3;
const NODE_SIZE_SLOTS = 4; // 4 Int32 slots = 16 bytes

// ============================================================
// Memory Arenas — pre-allocated, zero-GC
// ============================================================
const AST_ARENA_CAPACITY   = 512 * 1024;  // 512K slots (2MB)
const EXTRA_ARENA_CAPACITY = 512 * 1024;  // 512K Int32s (2MB)
const INTERN_POOL_CAPACITY = 2 * 1024 * 1024; // 2MB

// Main AST Arena: fixed-size 16-byte structs
const ast_nodes = new Int32Array(AST_ARENA_CAPACITY);
let ast_cursor = 0; // next free slot index (in Int32 units)

// AST Extra Data: variable-length children pointers (The Zig Hack)
const ast_extra = new Int32Array(EXTRA_ARENA_CAPACITY);
let extra_cursor = 0;

// String Intern Pool: raw UTF-8 bytes separated by \0
const intern_pool = new Uint8Array(INTERN_POOL_CAPACITY);
let intern_cursor = 1; // start at 1 so offset 0 means "no string"

// Symbol Table: reuse the arena.ohn hash table for intern dedup
const symbolScope = arena.allocateScope(null);

// Scratch Stack: collects child node indices to avoid
// interleaving with ast_extra pushes from nested parse calls.
// This is a pre-allocated Int32Array, NOT a dynamic array.
const SCRATCH_CAPACITY = 8192;
const scratch_stack = new Int32Array(SCRATCH_CAPACITY);
let scratch_cursor = 0;

// Source buffer reference (set by init)
let source = null;

// ============================================================
// Arena Writers — raw procedural functions, no objects
// ============================================================

// Allocate a 16-byte AST node, returns the slot index (in Int32 units)
function alloc_node(type_and_flags, source_location, data_1, data_2) {
    const idx = ast_cursor | 0;
    ast_nodes[idx]             = type_and_flags | 0;
    ast_nodes[(idx + 1) | 0]   = source_location | 0;
    ast_nodes[(idx + 2) | 0]   = data_1 | 0;
    ast_nodes[(idx + 3) | 0]   = data_2 | 0;
    ast_cursor = (idx + NODE_SIZE_SLOTS) | 0;
    return idx | 0;
}

// Push a child pointer into ast_extra, returns the index it was placed at
function push_extra(value) {
    const idx = extra_cursor | 0;
    ast_extra[idx] = value | 0;
    extra_cursor = (idx + 1) | 0;
    return idx | 0;
}

// ============================================================
// String Interning Engine (Hash Lookup + Unescaping)
// ============================================================

// Intern a raw identifier (no escape processing needed)
function intern_identifier(src_start, src_length) {
    src_start = src_start | 0;
    src_length = src_length | 0;

    // Hash the raw source bytes
    const hash = arena.fnv1a(source, src_start, src_length);

    // Probe the symbol table to see if already interned
    const u32 = symbolScope.u32;
    const u8 = symbolScope.u8;

    let index = ((hash >>> 0) % ((symbolScope.u32.length / 4) | 0)) | 0;
    while (true) {
        const structBase = (index * 4) | 0;
        const key_offset = u32[structBase] | 0;

        if (key_offset === 0) {
            // Not found — intern it into OUR intern_pool (not the arena's string area)
            const offset = intern_cursor | 0;
            for (let i = 0; i < src_length; i = (i + 1) | 0) {
                intern_pool[(offset + i) | 0] = source[(src_start + i) | 0];
            }
            intern_pool[(offset + src_length) | 0] = 0; // null terminator
            intern_cursor = (offset + src_length + 1) | 0;

            // Also insert into the arena's hash table so future lookups hit
            arena.insertSymbol(symbolScope, source, src_start, src_length, 0, offset);

            return offset | 0;
        }

        // Check if this is a match
        const slot_hash = u32[(structBase + 1) | 0] | 0;
        if ((slot_hash | 0) === (hash | 0)) {
            // Verify byte match against our intern pool
            const existing_offset = u32[(structBase + 3) | 0] | 0; // nodeRef stores intern offset
            let match = true;
            for (let i = 0; i < src_length; i = (i + 1) | 0) {
                if ((intern_pool[(existing_offset + i) | 0] | 0) !== (source[(src_start + i) | 0] | 0)) {
                    match = false;
                    break;
                }
            }
            if (match && (intern_pool[(existing_offset + src_length) | 0] | 0) === 0) {
                return existing_offset | 0;
            }
        }

        index = ((index + 1) | 0) % ((u32.length / 4) | 0);
        index = index | 0;
    }
}

// Intern a string literal WITH escape processing
function intern_string_literal(src_start, src_length) {
    src_start = src_start | 0;
    src_length = src_length | 0;

    const offset = intern_cursor | 0;
    let write_pos = offset | 0;
    const end = (src_start + src_length) | 0;
    let i = src_start | 0;

    while (i < end) {
        const byte = source[i] | 0;

        if (byte === 92) { // 0x5C = backslash
            i = (i + 1) | 0;
            if (i < end) {
                const esc = source[i] | 0;
                // Unescape state machine
                if (esc === 110) {        // 'n' -> 0x0A newline
                    intern_pool[write_pos] = 10;
                } else if (esc === 116) { // 't' -> 0x09 tab
                    intern_pool[write_pos] = 9;
                } else if (esc === 114) { // 'r' -> 0x0D carriage return
                    intern_pool[write_pos] = 13;
                } else if (esc === 92) {  // '\\' -> 0x5C backslash
                    intern_pool[write_pos] = 92;
                } else if (esc === 34) {  // '\"' -> 0x22 double quote
                    intern_pool[write_pos] = 34;
                } else if (esc === 39) {  // "\'" -> 0x27 single quote
                    intern_pool[write_pos] = 39;
                } else if (esc === 48) {  // '\0' -> 0x00 null
                    intern_pool[write_pos] = 0;
                } else {
                    // Unknown escape — copy literally
                    intern_pool[write_pos] = esc | 0;
                }
                write_pos = (write_pos + 1) | 0;
                i = (i + 1) | 0;
            }
        } else {
            intern_pool[write_pos] = byte | 0;
            write_pos = (write_pos + 1) | 0;
            i = (i + 1) | 0;
        }
    }

    // Null terminator
    intern_pool[write_pos] = 0;
    intern_cursor = (write_pos + 1) | 0;

    return offset | 0;
}

// ============================================================
// Zero-Allocation Numeric Parsing
// ascii_to_int: pure arithmetic accumulator, no parseFloat, no strings
// ============================================================
function ascii_to_int(start, length) {
    start = start | 0;
    length = length | 0;

    // Handle hex literals: 0x...
    if (length > 2 && (source[start] | 0) === 48) {
        const x = source[(start + 1) | 0] | 0;
        if (x === 120 || x === 88) { // 'x' or 'X'
            let value = 0;
            for (let i = (start + 2) | 0; i < (start + length) | 0; i = (i + 1) | 0) {
                const byte = source[i] | 0;
                let digit = 0;
                if (byte >= 48 && byte <= 57) {       // 0-9
                    digit = (byte - 48) | 0;
                } else if (byte >= 97 && byte <= 102) { // a-f
                    digit = ((byte - 97) + 10) | 0;
                } else if (byte >= 65 && byte <= 70) {  // A-F
                    digit = ((byte - 65) + 10) | 0;
                }
                value = ((value * 16) + digit) | 0;
            }
            return value | 0;
        }
    }

    let value = 0;
    const end = (start + length) | 0;
    for (let i = start | 0; i < end; i = (i + 1) | 0) {
        const byte = source[i] | 0;
        if (byte === 46) continue; // skip decimal dot for integer extraction
        value = ((value * 10) + (byte - 48)) | 0;
    }
    return value | 0;
}

// ============================================================
// ECMA-262 Operator Precedence for Pratt Parser
// Higher numbers = tighter binding
// ============================================================
function get_binding_power(tokenType) {
    tokenType = tokenType | 0;

    // Ternary/Conditional: ?
    if (tokenType === lexer.TOKEN_QUESTION) return 4;

    // Assignment operators: =, +=, -=, etc. (right-associative, lowest)
    if (tokenType === lexer.TOKEN_ASSIGN ||
        tokenType === lexer.TOKEN_PLUS_ASSIGN ||
        tokenType === lexer.TOKEN_MINUS_ASSIGN ||
        tokenType === lexer.TOKEN_MUL_ASSIGN ||
        tokenType === lexer.TOKEN_DIV_ASSIGN ||
        tokenType === lexer.TOKEN_MOD_ASSIGN ||
        tokenType === lexer.TOKEN_OR_ASSIGN ||
        tokenType === lexer.TOKEN_AND_ASSIGN ||
        tokenType === lexer.TOKEN_XOR_ASSIGN) return 3;

    // Logical OR: ||
    if (tokenType === lexer.TOKEN_LOGICAL_OR) return 5;
    // Logical AND: &&
    if (tokenType === lexer.TOKEN_LOGICAL_AND) return 6;
    // Bitwise OR: |
    if (tokenType === lexer.TOKEN_BIT_OR) return 7;
    // Bitwise XOR: ^
    if (tokenType === lexer.TOKEN_BIT_XOR) return 8;
    // Bitwise AND: &
    if (tokenType === lexer.TOKEN_BIT_AND) return 9;
    // Equality: ===, !==
    if (tokenType === lexer.TOKEN_STRICT_EQ || tokenType === lexer.TOKEN_STRICT_NEQ) return 10;
    // Relational: <, >, <=, >=
    if (tokenType === lexer.TOKEN_LT || tokenType === lexer.TOKEN_GT ||
        tokenType === lexer.TOKEN_LTE || tokenType === lexer.TOKEN_GTE) return 11;
    // Shift: <<, >>, >>>
    if (tokenType === lexer.TOKEN_LSHIFT || tokenType === lexer.TOKEN_RSHIFT ||
        tokenType === lexer.TOKEN_URSHIFT) return 12;
    // Additive: +, -
    if (tokenType === lexer.TOKEN_PLUS || tokenType === lexer.TOKEN_MINUS) return 13;
    // Multiplicative: *, /, %
    if (tokenType === lexer.TOKEN_MUL || tokenType === lexer.TOKEN_DIV ||
        tokenType === lexer.TOKEN_MOD) return 14;

    // Member/Call/Computed: ., (, [
    if (tokenType === lexer.TOKEN_DOT) return 19;
    if (tokenType === lexer.TOKEN_LPAREN) return 19;
    if (tokenType === lexer.TOKEN_LBRACKET) return 19;

    // Postfix ++/--: binds tighter than binary ops, looser than member access
    if (tokenType === lexer.TOKEN_INCREMENT || tokenType === lexer.TOKEN_DECREMENT) return 18;

    return 0;
}

// Check if a token is an assignment operator
function is_assignment_op(tokenType) {
    tokenType = tokenType | 0;
    return tokenType === lexer.TOKEN_ASSIGN ||
           tokenType === lexer.TOKEN_PLUS_ASSIGN ||
           tokenType === lexer.TOKEN_MINUS_ASSIGN ||
           tokenType === lexer.TOKEN_MUL_ASSIGN ||
           tokenType === lexer.TOKEN_DIV_ASSIGN ||
           tokenType === lexer.TOKEN_MOD_ASSIGN ||
           tokenType === lexer.TOKEN_OR_ASSIGN ||
           tokenType === lexer.TOKEN_AND_ASSIGN ||
           tokenType === lexer.TOKEN_XOR_ASSIGN;
}

// ============================================================
// Parser Entry Point
// ============================================================
function parse(sourceBuffer) {
    source = sourceBuffer;

    // Reset arenas
    ast_cursor = 0;
    extra_cursor = 0;
    intern_cursor = 1;
    scratch_cursor = 0;
    symbolScope.reset();

    // Initialize lexer
    lexer.init(sourceBuffer);

    // Parse the program
    return parse_program() | 0;
}

// ============================================================
// parse_program() — Root node, collects top-level statements
// Deferred push: collect children on scratch_stack, then batch-push.
// ============================================================
function parse_program() {
    // Save scratch cursor so nested calls don't clobber our entries
    const scratch_base = scratch_cursor | 0;
    let child_count = 0;

    while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {
        // Reserve a scratch slot for this child
        scratch_cursor = (scratch_base + child_count + 1) | 0;
        const stmt = parse_statement() | 0;
        // -1 means a TypeScript-only construct was skipped (e.g. 'type X = {...}')
        if (stmt !== -1) {
            scratch_stack[(scratch_base + child_count) | 0] = stmt | 0;
            child_count = (child_count + 1) | 0;
        }
    }

    // Batch-push children to ast_extra now that all nested parsing is done
    const extra_start = extra_cursor | 0;
    for (let i = 0; i < child_count; i = (i + 1) | 0) {
        push_extra(scratch_stack[(scratch_base + i) | 0] | 0);
    }

    // Restore scratch cursor
    scratch_cursor = scratch_base | 0;

    // Allocate the Program node
    const node = alloc_node(
        NODE_PROGRAM,
        0,
        child_count | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_statement()
// ============================================================
function parse_statement() {
    const token_type = lexer.lex_register[lexer.REG_TYPE] | 0;

    // Variable Declaration: const, let, var
    if (token_type === lexer.TOKEN_CONST ||
        token_type === lexer.TOKEN_LET ||
        token_type === lexer.TOKEN_VAR) {
        return parse_variable_declaration() | 0;
    }

    // Function Declaration
    if (token_type === lexer.TOKEN_FUNCTION) {
        return parse_function_declaration() | 0;
    }

    // If Statement
    if (token_type === lexer.TOKEN_IF) {
        return parse_if_statement() | 0;
    }

    // While Statement
    if (token_type === lexer.TOKEN_WHILE) {
        return parse_while_statement() | 0;
    }

    // For Statement
    if (token_type === lexer.TOKEN_FOR) {
        return parse_for_statement() | 0;
    }

    // Return Statement
    if (token_type === lexer.TOKEN_RETURN) {
        return parse_return_statement() | 0;
    }

    // Throw Statement
    if (token_type === lexer.TOKEN_THROW) {
        return parse_throw_statement() | 0;
    }

    // Break Statement
    if (token_type === lexer.TOKEN_BREAK) {
        return parse_break_statement() | 0;
    }

    // Continue Statement
    if (token_type === lexer.TOKEN_CONTINUE) {
        return parse_continue_statement() | 0;
    }

    // Class Declaration
    if (token_type === lexer.TOKEN_CLASS) {
        return parse_class_declaration() | 0;
    }

    // Block Statement
    if (token_type === lexer.TOKEN_LBRACE) {
        return parse_block_statement() | 0;
    }

    // TypeScript 'type' alias declaration: type X = { ... };
    // Also handles: export type X = { ... };
    // These are entirely ignored — they carry no runtime semantics.
    if (token_type === lexer.TOKEN_IDENTIFIER) {
        // Check for bare 'type' keyword (lexed as IDENTIFIER since it's not reserved)
        const type_start = lexer.lex_register[lexer.REG_START]  | 0;
        const type_len   = lexer.lex_register[lexer.REG_LENGTH] | 0;
        // 'type' is 4 bytes: 116, 121, 112, 101
        if (type_len === 4) {
            const b0 = (source[type_start | 0])       | 0;
            const b1 = (source[(type_start + 1) | 0]) | 0;
            const b2 = (source[(type_start + 2) | 0]) | 0;
            const b3 = (source[(type_start + 3) | 0]) | 0;
            if (b0 === 116 && b1 === 121 && b2 === 112 && b3 === 101) {
                // 'type Name = { ... };' — skip to matching '}' then ';'
                lexer.advance(); // consume 'type'
                // skip name
                if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_IDENTIFIER) {
                    lexer.advance();
                }
                // skip '='
                if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_ASSIGN) {
                    lexer.advance();
                }
                // skip the entire type body until ';' — handles:
                //   { ... }  object types
                //   (a: T) => void  function types
                //   string | number  union types
                // Track depth for nested parens/braces
                let depth = 0;
                while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {
                    const tt = lexer.lex_register[lexer.REG_TYPE] | 0;
                    if (tt === lexer.TOKEN_LBRACE || tt === lexer.TOKEN_LPAREN) {
                        depth = (depth + 1) | 0;
                    } else if (tt === lexer.TOKEN_RBRACE || tt === lexer.TOKEN_RPAREN) {
                        depth = (depth - 1) | 0;
                    } else if (tt === lexer.TOKEN_SEMICOLON && depth === 0) {
                        lexer.advance(); // consume ';'
                        break;
                    }
                    lexer.advance();
                }
                // Return a dummy node index — use -1 (caller filters negative children)
                return -1;
            }
        }
    }

    // 'export' keyword — handle 'export type X = {...}' and 'export function ...'
    // For now: skip 'export' and re-enter parse_statement
    if (token_type === lexer.TOKEN_IDENTIFIER) {
        const ex_start = lexer.lex_register[lexer.REG_START]  | 0;
        const ex_len   = lexer.lex_register[lexer.REG_LENGTH] | 0;
        // 'export' is 6 bytes: 101,120,112,111,114,116
        if (ex_len === 6) {
            const b0 = (source[ex_start | 0])       | 0;
            const b1 = (source[(ex_start + 1) | 0]) | 0;
            const b2 = (source[(ex_start + 2) | 0]) | 0;
            if (b0 === 101 && b1 === 120 && b2 === 112) {
                const b3 = (source[(ex_start + 3) | 0]) | 0;
                const b4 = (source[(ex_start + 4) | 0]) | 0;
                const b5 = (source[(ex_start + 5) | 0]) | 0;
                if (b3 === 111 && b4 === 114 && b5 === 116) {
                    lexer.advance(); // consume 'export'
                    return parse_statement() | 0;
                }
            }
        }
    }

    // Expression Statement (fallback)
    return parse_expression_statement() | 0;
}

// ============================================================
// parse_block_statement() — { ... }
// data_1 = child_count, data_2 = extra_start
// ============================================================
function parse_block_statement() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume '{'
    lexer.expect(lexer.TOKEN_LBRACE);

    const scratch_base = scratch_cursor | 0;
    let child_count = 0;

    while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_RBRACE &&
           (lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {
        scratch_cursor = (scratch_base + child_count + 1) | 0;
        const stmt = parse_statement() | 0;
        // -1 means a TypeScript-only construct was skipped
        if (stmt !== -1) {
            scratch_stack[(scratch_base + child_count) | 0] = stmt | 0;
            child_count = (child_count + 1) | 0;
        }
    }

    // Consume '}'
    lexer.expect(lexer.TOKEN_RBRACE);

    // Batch-push
    const extra_start = extra_cursor | 0;
    for (let i = 0; i < child_count; i = (i + 1) | 0) {
        push_extra(scratch_stack[(scratch_base + i) | 0] | 0);
    }
    scratch_cursor = scratch_base | 0;

    const node = alloc_node(
        NODE_BLOCK_STATEMENT,
        src_loc | 0,
        child_count | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_variable_declaration()
// const message = "hello";
// ============================================================
function parse_variable_declaration() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;
    const kind_token = lexer.lex_register[lexer.REG_TYPE] | 0;

    // Determine flag
    let flag = 0;
    if (kind_token === lexer.TOKEN_CONST) flag = FLAG_CONST;
    else if (kind_token === lexer.TOKEN_LET) flag = FLAG_LET;
    else flag = FLAG_VAR;

    // Consume the keyword
    lexer.advance();

    // Parse declarator (MVP: single declarator)
    const declarator = parse_variable_declarator() | 0;

    // Batch-push AFTER parsing is complete (no interleaving)
    const extra_start = extra_cursor | 0;
    push_extra(declarator);
    const decl_count = 1;

    // Consume semicolon
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_SEMICOLON) {
        lexer.advance();
    }

    // Allocate VariableDeclaration node
    const node = alloc_node(
        (NODE_VARIABLE_DECLARATION | flag) | 0,
        src_loc | 0,
        decl_count | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_variable_declarator()
// message = "hello"
// ============================================================
function parse_variable_declarator() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Parse the identifier (LHS)
    const id_node = parse_identifier() | 0;

    // Skip TypeScript optional marker '?' before ':'
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_QUESTION) {
        lexer.advance();
    }

    // Skip TypeScript type annotation ': Type'
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_COLON) {
        lexer.advance();
        skip_type_annotation();
    }

    let init_node = -1;
    // Check for '=' initializer
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_ASSIGN) {
        lexer.advance();
        // Parse the initializer (RHS)
        init_node = parse_expression(0) | 0;
    }

    // Allocate VariableDeclarator node
    const node = alloc_node(
        NODE_VARIABLE_DECLARATOR,
        src_loc | 0,
        id_node | 0,    // data_1: LHS (Identifier node index)
        init_node | 0    // data_2: RHS (expression node index), -1 if no init
    );

    return node | 0;
}

// ============================================================
// parse_function_declaration()
// function foo(a, b) { ... }
// data_1 = name identifier node, data_2 = extra_start
// ast_extra: [param_count, ...param_nodes, body_node]
// ============================================================
function parse_function_declaration() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume 'function'
    lexer.advance();

    // Parse function name
    const name_node = parse_identifier() | 0;

    // Consume '('
    lexer.expect(lexer.TOKEN_LPAREN);

    // Collect parameters on scratch
    const scratch_base = scratch_cursor | 0;
    let param_count = 0;

    while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_RPAREN &&
           (lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {
        if (param_count > 0) {
            lexer.expect(lexer.TOKEN_COMMA);
        }
        scratch_cursor = (scratch_base + param_count + 1) | 0;

        // Parse parameter identifier
        const param = parse_identifier() | 0;
        scratch_stack[(scratch_base + param_count) | 0] = param | 0;
        param_count = (param_count + 1) | 0;

        // Skip TypeScript optional marker '?' and type annotation ': Type'
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_QUESTION) {
            lexer.advance();
        }
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_COLON) {
            lexer.advance();
            // Skip type expression — could be 'Uint8Array', 'Buffer', etc.
            skip_type_annotation();
        }

        // Skip default parameter value: = expr
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_ASSIGN) {
            lexer.advance();
            parse_expression(0); // consume the default value
        }
    }

    // Consume ')'
    lexer.expect(lexer.TOKEN_RPAREN);

    // Skip TypeScript return type annotation ': ReturnType' before '{'
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_COLON) {
        lexer.advance();
        skip_type_annotation();
    }

    // Parse body
    scratch_cursor = (scratch_base + param_count + 1) | 0;
    const body = parse_block_statement() | 0;

    // Batch-push: [param_count, ...params, body]
    const extra_start = extra_cursor | 0;
    push_extra(param_count | 0);
    for (let i = 0; i < param_count; i = (i + 1) | 0) {
        push_extra(scratch_stack[(scratch_base + i) | 0] | 0);
    }
    push_extra(body | 0);

    scratch_cursor = scratch_base | 0;

    const node = alloc_node(
        NODE_FUNCTION_DECLARATION,
        src_loc | 0,
        name_node | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// skip_type_annotation() — skip TypeScript-style type annotations
// Consumes identifiers, |, [], and generic brackets
// ============================================================
function skip_type_annotation() {
    // Handle 'void' keyword (return type)
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_IDENTIFIER) {
        lexer.advance();
    } else if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_NULL ||
               (lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_UNDEFINED) {
        lexer.advance();
    }

    // Handle '[]' array suffix
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_LBRACKET) {
        lexer.advance();
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_RBRACKET) {
            lexer.advance();
        }
    }

    // Handle union types: Type | Type | ...
    while ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_BIT_OR) {
        lexer.advance();
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_IDENTIFIER ||
            (lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_NULL ||
            (lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_UNDEFINED) {
            lexer.advance();
        }
        // Handle '[]' after union member
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_LBRACKET) {
            lexer.advance();
            if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_RBRACKET) {
                lexer.advance();
            }
        }
    }
}

// ============================================================
// parse_if_statement()
// if (cond) { ... } else if (cond) { ... } else { ... }
// data_1 = condition node, data_2 = extra_start
// ast_extra: [consequent, alternate] (alternate = -1 if none)
// ============================================================
function parse_if_statement() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume 'if'
    lexer.advance();

    // Consume '('
    lexer.expect(lexer.TOKEN_LPAREN);

    // Parse condition
    const condition = parse_expression(0) | 0;

    // Consume ')'
    lexer.expect(lexer.TOKEN_RPAREN);

    // Parse consequent (the if-body — may or may not have braces)
    const consequent = parse_block_or_statement() | 0;

    // Parse optional else / else if
    let alternate = -1;
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_ELSE) {
        lexer.advance();
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_IF) {
            // else if => parse recursively as another if statement
            alternate = parse_if_statement() | 0;
        } else {
            // else { ... } or else single-statement
            alternate = parse_block_or_statement() | 0;
        }
    }

    // Push consequent and alternate to ast_extra
    const extra_start = extra_cursor | 0;
    push_extra(consequent | 0);
    push_extra(alternate | 0);

    const node = alloc_node(
        NODE_IF_STATEMENT,
        src_loc | 0,
        condition | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_while_statement()
// while (cond) { ... }
// data_1 = condition, data_2 = body
// ============================================================
function parse_while_statement() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume 'while'
    lexer.advance();

    // Consume '('
    lexer.expect(lexer.TOKEN_LPAREN);

    // Parse condition
    const condition = parse_expression(0) | 0;

    // Consume ')'
    lexer.expect(lexer.TOKEN_RPAREN);

    // Parse body
    const body = parse_block_or_statement() | 0;

    const node = alloc_node(
        NODE_WHILE_STATEMENT,
        src_loc | 0,
        condition | 0,
        body | 0
    );

    return node | 0;
}

// ============================================================
// parse_for_statement()
// for (init; test; update) { ... }
// data_1 = extra_start, data_2 = body
// ast_extra: [init, test, update]
// ============================================================
function parse_for_statement() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume 'for'
    lexer.advance();

    // Consume '('
    lexer.expect(lexer.TOKEN_LPAREN);

    // Parse init (can be var decl or expression or empty)
    let init_node = -1;
    const init_type = lexer.lex_register[lexer.REG_TYPE] | 0;
    if (init_type === lexer.TOKEN_CONST ||
        init_type === lexer.TOKEN_LET ||
        init_type === lexer.TOKEN_VAR) {
        init_node = parse_variable_declaration_no_semi() | 0;
    } else if (init_type !== lexer.TOKEN_SEMICOLON) {
        init_node = parse_expression(0) | 0;
    }

    // Consume ';' after init
    lexer.expect(lexer.TOKEN_SEMICOLON);

    // Parse test (can be empty)
    let test_node = -1;
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_SEMICOLON) {
        test_node = parse_expression(0) | 0;
    }

    // Consume ';' after test
    lexer.expect(lexer.TOKEN_SEMICOLON);

    // Parse update (can be empty)
    let update_node = -1;
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_RPAREN) {
        update_node = parse_expression(0) | 0;
    }

    // Consume ')'
    lexer.expect(lexer.TOKEN_RPAREN);

    // Parse body
    const body = parse_block_or_statement() | 0;

    // Push init, test, update to extra
    const extra_start = extra_cursor | 0;
    push_extra(init_node | 0);
    push_extra(test_node | 0);
    push_extra(update_node | 0);

    const node = alloc_node(
        NODE_FOR_STATEMENT,
        src_loc | 0,
        extra_start | 0,
        body | 0
    );

    return node | 0;
}

// ============================================================
// parse_variable_declaration_no_semi() — for-loop init
// Same as parse_variable_declaration but does NOT consume the semicolon
// ============================================================
function parse_variable_declaration_no_semi() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;
    const kind_token = lexer.lex_register[lexer.REG_TYPE] | 0;

    let flag = 0;
    if (kind_token === lexer.TOKEN_CONST) flag = FLAG_CONST;
    else if (kind_token === lexer.TOKEN_LET) flag = FLAG_LET;
    else flag = FLAG_VAR;

    lexer.advance();

    const declarator = parse_variable_declarator() | 0;

    const extra_start = extra_cursor | 0;
    push_extra(declarator);

    const node = alloc_node(
        (NODE_VARIABLE_DECLARATION | flag) | 0,
        src_loc | 0,
        1,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_block_or_statement() — helper for while/for body
// ============================================================
function parse_block_or_statement() {
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_LBRACE) {
        return parse_block_statement() | 0;
    }
    return parse_statement() | 0;
}

// ============================================================
// parse_return_statement()
// return expr;
// data_1 = expression (-1 if bare return), data_2 = 0
// ============================================================
function parse_return_statement() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume 'return'
    lexer.advance();

    let expr = -1;
    // Check if there's an expression (not followed by ; or } or EOF)
    const next = lexer.lex_register[lexer.REG_TYPE] | 0;
    if (next !== lexer.TOKEN_SEMICOLON &&
        next !== lexer.TOKEN_RBRACE &&
        next !== lexer.TOKEN_EOF) {
        expr = parse_expression(0) | 0;
    }

    // Consume semicolon
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_SEMICOLON) {
        lexer.advance();
    }

    const node = alloc_node(
        NODE_RETURN_STATEMENT,
        src_loc | 0,
        expr | 0,
        0
    );

    return node | 0;
}

// ============================================================
// parse_throw_statement()
// throw expr;
// data_1 = expression, data_2 = 0
// ============================================================
function parse_throw_statement() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume 'throw'
    lexer.advance();

    const expr = parse_expression(0) | 0;

    // Consume semicolon
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_SEMICOLON) {
        lexer.advance();
    }

    const node = alloc_node(
        NODE_THROW_STATEMENT,
        src_loc | 0,
        expr | 0,
        0
    );

    return node | 0;
}

// ============================================================
// parse_break_statement() / parse_continue_statement()
// ============================================================
function parse_break_statement() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;
    lexer.advance();
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_SEMICOLON) {
        lexer.advance();
    }
    return alloc_node(NODE_BREAK_STATEMENT, src_loc | 0, 0, 0) | 0;
}

function parse_continue_statement() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;
    lexer.advance();
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_SEMICOLON) {
        lexer.advance();
    }
    return alloc_node(NODE_CONTINUE_STATEMENT, src_loc | 0, 0, 0) | 0;
}

// ============================================================
// parse_class_declaration()
// class Foo { constructor(a, b) { ... } method() { ... } }
// data_1 = name identifier, data_2 = extra_start
// ast_extra: [method_count, ...method_nodes]
// ============================================================
function parse_class_declaration() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume 'class'
    lexer.advance();

    // Parse class name
    const name_node = parse_identifier() | 0;

    // Consume '{'
    lexer.expect(lexer.TOKEN_LBRACE);

    // Parse methods
    const scratch_base = scratch_cursor | 0;
    let method_count = 0;

    while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_RBRACE &&
           (lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {
        scratch_cursor = (scratch_base + method_count + 1) | 0;
        const method = parse_method_definition() | 0;
        scratch_stack[(scratch_base + method_count) | 0] = method | 0;
        method_count = (method_count + 1) | 0;
    }

    // Consume '}'
    lexer.expect(lexer.TOKEN_RBRACE);

    // Batch-push: [method_count, ...methods]
    const extra_start = extra_cursor | 0;
    push_extra(method_count | 0);
    for (let i = 0; i < method_count; i = (i + 1) | 0) {
        push_extra(scratch_stack[(scratch_base + i) | 0] | 0);
    }
    scratch_cursor = scratch_base | 0;

    const node = alloc_node(
        NODE_CLASS_DECLARATION,
        src_loc | 0,
        name_node | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_method_definition()
// constructor(params) { ... } or method(params) { ... }
// data_1 = name identifier, data_2 = extra_start
// ast_extra: [param_count, ...param_nodes, body_node]
// (same layout as function)
// ============================================================
function parse_method_definition() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Parse method name
    const name_node = parse_identifier() | 0;

    // Consume '('
    lexer.expect(lexer.TOKEN_LPAREN);

    // Collect parameters
    const scratch_base = scratch_cursor | 0;
    let param_count = 0;

    while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_RPAREN &&
           (lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {
        if (param_count > 0) {
            lexer.expect(lexer.TOKEN_COMMA);
        }
        scratch_cursor = (scratch_base + param_count + 1) | 0;
        const param = parse_identifier() | 0;
        scratch_stack[(scratch_base + param_count) | 0] = param | 0;
        param_count = (param_count + 1) | 0;

        // Skip default value: = expr
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_ASSIGN) {
            lexer.advance();
            parse_expression(0);
        }
    }

    // Consume ')'
    lexer.expect(lexer.TOKEN_RPAREN);

    // Parse body
    scratch_cursor = (scratch_base + param_count + 1) | 0;
    const body = parse_block_statement() | 0;

    // Batch-push
    const extra_start = extra_cursor | 0;
    push_extra(param_count | 0);
    for (let i = 0; i < param_count; i = (i + 1) | 0) {
        push_extra(scratch_stack[(scratch_base + i) | 0] | 0);
    }
    push_extra(body | 0);

    scratch_cursor = scratch_base | 0;

    const node = alloc_node(
        NODE_METHOD_DEFINITION,
        src_loc | 0,
        name_node | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_identifier() — Reads current Identifier token, interns it
// ============================================================
function parse_identifier() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;
    const src_len = lexer.lex_register[lexer.REG_LENGTH] | 0;

    // Intern the identifier bytes into the pool
    const intern_offset = intern_identifier(src_loc, src_len) | 0;

    // Consume the identifier token
    lexer.advance();

    // Allocate Identifier node
    const node = alloc_node(
        NODE_IDENTIFIER,
        src_loc | 0,
        intern_offset | 0,  // data_1: pointer to Intern Pool
        0                    // data_2: unused
    );

    return node | 0;
}

// ============================================================
// parse_expression_statement()
// console.log(message);
// ============================================================
function parse_expression_statement() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    const expr = parse_expression(0) | 0;

    // Consume semicolon if present
    if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_SEMICOLON) {
        lexer.advance();
    }

    const node = alloc_node(
        NODE_EXPRESSION_STATEMENT,
        src_loc | 0,
        expr | 0,  // data_1: the expression
        0          // data_2: unused
    );

    return node | 0;
}

// ============================================================
// parse_expression(min_bp) — Pratt Parser core
// ============================================================
function parse_expression(min_bp) {
    min_bp = min_bp | 0;

    // Prefix / Atom: parse the left-hand side
    let left = parse_prefix() | 0;

    // Infix loop: check the PEEK token's binding power
    while (true) {
        const peek_type = lexer.lex_register[lexer.REG_TYPE] | 0;
        const bp = get_binding_power(peek_type) | 0;

        if (bp <= min_bp) break;

        // Member access: .
        if (peek_type === lexer.TOKEN_DOT) {
            left = parse_member_expression(left) | 0;
            continue;
        }

        // Computed member access: [
        if (peek_type === lexer.TOKEN_LBRACKET) {
            left = parse_computed_member_expression(left) | 0;
            continue;
        }

        // Call expression: (
        if (peek_type === lexer.TOKEN_LPAREN) {
            left = parse_call_expression(left) | 0;
            continue;
        }

        // Postfix ++/--
        if (peek_type === lexer.TOKEN_INCREMENT || peek_type === lexer.TOKEN_DECREMENT) {
            const upd_loc = lexer.lex_register[lexer.REG_START] | 0;
            const op_token = peek_type | 0;
            lexer.advance();
            // Postfix: FLAG_PREFIX is NOT set (0)
            left = alloc_node(
                (NODE_UPDATE_EXPRESSION | (op_token << 16)) | 0,
                upd_loc | 0,
                left | 0,
                0
            ) | 0;
            continue;
        }

        // Ternary conditional: ?
        if (peek_type === lexer.TOKEN_QUESTION) {
            const tern_loc = lexer.lex_register[lexer.REG_START] | 0;
            lexer.advance(); // consume '?'
            const consequent = parse_expression(0) | 0; // parse consequent
            lexer.expect(lexer.TOKEN_COLON); // consume ':'
            const alternate = parse_expression(3) | 0; // right-associative, parse alternate
            // data_1 = condition (left), data_2 = extra_start
            // ast_extra: [consequent, alternate]
            const extra_start = extra_cursor | 0;
            push_extra(consequent | 0);
            push_extra(alternate | 0);
            left = alloc_node(
                NODE_CONDITIONAL_EXPRESSION,
                tern_loc | 0,
                left | 0,
                extra_start | 0
            ) | 0;
            continue;
        }

        // Assignment operators (right-associative)
        if (is_assignment_op(peek_type)) {
            const assign_loc = lexer.lex_register[lexer.REG_START] | 0;
            const assign_op = peek_type | 0;
            lexer.advance();
            // Right-associative: use bp - 1 for right side
            const right = parse_expression((bp - 1) | 0) | 0;
            left = alloc_node(
                (NODE_ASSIGNMENT_EXPRESSION | (assign_op << 16)) | 0,
                assign_loc | 0,
                left | 0,
                right | 0
            ) | 0;
            continue;
        }

        // Binary operators
        const bin_loc = lexer.lex_register[lexer.REG_START] | 0;
        const bin_op = peek_type | 0;
        lexer.advance();
        const right = parse_expression(bp | 0) | 0;
        left = alloc_node(
            (NODE_BINARY_EXPRESSION | (bin_op << 16)) | 0,
            bin_loc | 0,
            left | 0,
            right | 0
        ) | 0;
    }

    return left | 0;
}

// ============================================================
// parse_prefix() — Prefix unary and atoms
// ============================================================
function parse_prefix() {
    const token_type = lexer.lex_register[lexer.REG_TYPE] | 0;

    // Prefix unary operators: !, -, +, typeof
    if (token_type === lexer.TOKEN_LOGICAL_NOT ||
        token_type === lexer.TOKEN_MINUS ||
        token_type === lexer.TOKEN_PLUS ||
        token_type === lexer.TOKEN_TYPEOF) {
        const src_loc = lexer.lex_register[lexer.REG_START] | 0;
        const op = token_type | 0;
        lexer.advance();
        // Unary binds tighter than all binary ops
        const operand = parse_expression(16) | 0;
        const node = alloc_node(
            (NODE_UNARY_EXPRESSION | (op << 16)) | 0,
            src_loc | 0,
            operand | 0,
            0
        );
        return node | 0;
    }

    // Prefix ++ / --
    if (token_type === lexer.TOKEN_INCREMENT || token_type === lexer.TOKEN_DECREMENT) {
        const src_loc = lexer.lex_register[lexer.REG_START] | 0;
        const op = token_type | 0;
        lexer.advance();
        const operand = parse_expression(16) | 0;
        const node = alloc_node(
            (NODE_UPDATE_EXPRESSION | FLAG_PREFIX | (op << 16)) | 0,
            src_loc | 0,
            operand | 0,
            0
        );
        return node | 0;
    }

    // 'new' expression
    if (token_type === lexer.TOKEN_NEW) {
        return parse_new_expression() | 0;
    }

    // Atom
    return parse_atom() | 0;
}

// ============================================================
// parse_atom() — Terminal expression nodes
// ============================================================
function parse_atom() {
    const token_type = lexer.lex_register[lexer.REG_TYPE] | 0;
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;
    const src_len = lexer.lex_register[lexer.REG_LENGTH] | 0;

    // Identifier
    if (token_type === lexer.TOKEN_IDENTIFIER) {
        return parse_identifier() | 0;
    }

    // String Literal
    if (token_type === lexer.TOKEN_STRING) {
        const intern_offset = intern_string_literal(src_loc, src_len) | 0;
        lexer.advance();
        const node = alloc_node(
            (NODE_LITERAL | FLAG_STRING) | 0,
            src_loc | 0,
            intern_offset | 0,  // data_1: Intern Pool offset
            0
        );
        return node | 0;
    }

    // Number Literal
    if (token_type === lexer.TOKEN_NUMBER) {
        const value = ascii_to_int(src_loc, src_len) | 0;
        lexer.advance();
        const node = alloc_node(
            (NODE_LITERAL | FLAG_NUMBER) | 0,
            src_loc | 0,
            value | 0,  // data_1: inline numeric value
            0
        );
        return node | 0;
    }

    // Boolean Literals: true, false
    if (token_type === lexer.TOKEN_TRUE) {
        lexer.advance();
        return alloc_node((NODE_LITERAL | FLAG_BOOLEAN) | 0, src_loc | 0, 1, 0) | 0;
    }
    if (token_type === lexer.TOKEN_FALSE) {
        lexer.advance();
        return alloc_node((NODE_LITERAL | FLAG_BOOLEAN) | 0, src_loc | 0, 0, 0) | 0;
    }

    // null
    if (token_type === lexer.TOKEN_NULL) {
        lexer.advance();
        return alloc_node((NODE_LITERAL | FLAG_NULL) | 0, src_loc | 0, 0, 0) | 0;
    }

    // undefined
    if (token_type === lexer.TOKEN_UNDEFINED) {
        lexer.advance();
        return alloc_node((NODE_LITERAL | FLAG_UNDEFINED) | 0, src_loc | 0, 0, 0) | 0;
    }

    // this
    if (token_type === lexer.TOKEN_THIS) {
        lexer.advance();
        return alloc_node(NODE_THIS_EXPRESSION, src_loc | 0, 0, 0) | 0;
    }

    // Parenthesized expression: ( expr )
    if (token_type === lexer.TOKEN_LPAREN) {
        lexer.advance();
        const inner = parse_expression(0) | 0;
        lexer.expect(lexer.TOKEN_RPAREN);
        return inner | 0;
    }

    // Array expression: [ ... ]
    if (token_type === lexer.TOKEN_LBRACKET) {
        return parse_array_expression() | 0;
    }

    // Object expression: { key: value, ... }
    if (token_type === lexer.TOKEN_LBRACE) {
        return parse_object_expression() | 0;
    }

    throw new Error('Unexpected token type ' + token_type + ' at byte offset ' + src_loc);
}

// ============================================================
// parse_new_expression() — new ClassName(args)
// data_1 = callee, data_2 = extra_start
// ast_extra: [arg_count, ...args]
// ============================================================
function parse_new_expression() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume 'new'
    lexer.advance();

    // Parse the constructor callee (could be dotted: new foo.Bar())
    let callee = parse_identifier() | 0;

    // Handle dotted constructors: new Foo.Bar()
    while ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_DOT) {
        callee = parse_member_expression(callee) | 0;
    }

    // Parse arguments
    lexer.expect(lexer.TOKEN_LPAREN);

    const scratch_base = scratch_cursor | 0;
    let arg_count = 0;

    while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_RPAREN &&
           (lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {
        if (arg_count > 0) {
            lexer.expect(lexer.TOKEN_COMMA);
        }
        scratch_cursor = (scratch_base + arg_count + 1) | 0;
        const arg = parse_expression(0) | 0;
        scratch_stack[(scratch_base + arg_count) | 0] = arg | 0;
        arg_count = (arg_count + 1) | 0;
    }

    lexer.expect(lexer.TOKEN_RPAREN);

    // Batch-push
    const extra_start = extra_cursor | 0;
    push_extra(arg_count | 0);
    for (let i = 0; i < arg_count; i = (i + 1) | 0) {
        push_extra(scratch_stack[(scratch_base + i) | 0] | 0);
    }
    scratch_cursor = scratch_base | 0;

    // Detect Float32Array constructor: byte-compare callee intern name
    // The callee is a NODE_IDENTIFIER; its intern offset is in SLOT_DATA_1.
    // "Float32Array" = 12 bytes: 70 108 111 97 116 51 50 65 114 114 97 121
    let is_f32 = false;
    const callee_intern_off = ast_nodes[(callee + 2) | 0] | 0;
    if (callee_intern_off > 0) {
        const F = 70; const l = 108; const o = 111; const a = 97;
        const t = 116; const n3 = 51; const n2 = 50; const A = 65;
        const r = 114; const y = 121;
        if (
            (intern_pool[(callee_intern_off + 0) | 0] | 0) === F  &&
            (intern_pool[(callee_intern_off + 1) | 0] | 0) === l  &&
            (intern_pool[(callee_intern_off + 2) | 0] | 0) === o  &&
            (intern_pool[(callee_intern_off + 3) | 0] | 0) === a  &&
            (intern_pool[(callee_intern_off + 4) | 0] | 0) === t  &&
            (intern_pool[(callee_intern_off + 5) | 0] | 0) === n3 &&
            (intern_pool[(callee_intern_off + 6) | 0] | 0) === n2 &&
            (intern_pool[(callee_intern_off + 7) | 0] | 0) === A  &&
            (intern_pool[(callee_intern_off + 8) | 0] | 0) === r  &&
            (intern_pool[(callee_intern_off + 9) | 0] | 0) === r  &&
            (intern_pool[(callee_intern_off + 10) | 0] | 0) === a &&
            (intern_pool[(callee_intern_off + 11) | 0] | 0) === y &&
            (intern_pool[(callee_intern_off + 12) | 0] | 0) === 0
        ) {
            is_f32 = true;
        }
    }

    const node = alloc_node(
        (is_f32 ? (NODE_NEW_EXPRESSION | FLAG_FLOAT) : NODE_NEW_EXPRESSION) | 0,
        src_loc | 0,
        callee | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_array_expression() — [a, b, c]
// data_1 = element_count, data_2 = extra_start
// ============================================================
function parse_array_expression() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume '['
    lexer.advance();

    const scratch_base = scratch_cursor | 0;
    let count = 0;

    while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_RBRACKET &&
           (lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {
        if (count > 0) {
            lexer.expect(lexer.TOKEN_COMMA);
        }
        scratch_cursor = (scratch_base + count + 1) | 0;
        const elem = parse_expression(0) | 0;
        scratch_stack[(scratch_base + count) | 0] = elem | 0;
        count = (count + 1) | 0;
    }

    // Consume ']'
    lexer.expect(lexer.TOKEN_RBRACKET);

    // Batch-push
    const extra_start = extra_cursor | 0;
    for (let i = 0; i < count; i = (i + 1) | 0) {
        push_extra(scratch_stack[(scratch_base + i) | 0] | 0);
    }
    scratch_cursor = scratch_base | 0;

    const node = alloc_node(
        NODE_ARRAY_EXPRESSION,
        src_loc | 0,
        count | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_object_expression() — { key: value, ... }
// data_1 = property_count, data_2 = extra_start
// ============================================================
function parse_object_expression() {
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume '{'
    lexer.advance();

    const scratch_base = scratch_cursor | 0;
    let count = 0;

    while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_RBRACE &&
           (lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {
        scratch_cursor = (scratch_base + count + 1) | 0;

        const prop_loc = lexer.lex_register[lexer.REG_START] | 0;
        const key = parse_identifier() | 0;

        let value = key; // shorthand: { foo } => { foo: foo }
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_COLON) {
            lexer.advance();
            value = parse_expression(0) | 0;
        }

        const prop = alloc_node(
            NODE_PROPERTY,
            prop_loc | 0,
            key | 0,
            value | 0
        ) | 0;

        scratch_stack[(scratch_base + count) | 0] = prop | 0;
        count = (count + 1) | 0;

        // Consume optional comma (handles both separator and trailing commas)
        if ((lexer.lex_register[lexer.REG_TYPE] | 0) === lexer.TOKEN_COMMA) {
            lexer.advance();
        }
    }

    // Consume '}'
    lexer.expect(lexer.TOKEN_RBRACE);

    const extra_start = extra_cursor | 0;
    for (let i = 0; i < count; i = (i + 1) | 0) {
        push_extra(scratch_stack[(scratch_base + i) | 0] | 0);
    }
    scratch_cursor = scratch_base | 0;

    const node = alloc_node(
        NODE_OBJECT_EXPRESSION,
        src_loc | 0,
        count | 0,
        extra_start | 0
    );

    return node | 0;
}

// ============================================================
// parse_member_expression(left) — foo.bar (non-computed)
// ============================================================
function parse_member_expression(left) {
    left = left | 0;
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume '.'
    lexer.advance();

    // Parse the right-hand identifier
    const right = parse_identifier() | 0;

    const node = alloc_node(
        NODE_MEMBER_EXPRESSION,
        src_loc | 0,
        left | 0,   // data_1: object (LHS)
        right | 0    // data_2: property (RHS)
    );

    return node | 0;
}

// ============================================================
// parse_computed_member_expression(left) — foo[expr] (computed)
// ============================================================
function parse_computed_member_expression(left) {
    left = left | 0;
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume '['
    lexer.advance();

    // Parse the index expression
    const index_expr = parse_expression(0) | 0;

    // Consume ']'
    lexer.expect(lexer.TOKEN_RBRACKET);

    // Propagate FLAG_FLOAT from object (left) to this member node.
    // If the LHS is a Float32Array (or a Float32Array-typed member),
    // this subscript access is also float-typed. The LLVM backend uses
    // this to emit getelementptr float / load float instead of i32.
    const left_tf = ast_nodes[left | 0] | 0;
    const left_is_float = (left_tf & FLAG_FLOAT) | 0;

    const node = alloc_node(
        ((NODE_MEMBER_EXPRESSION | FLAG_COMPUTED) | (left_is_float ? FLAG_FLOAT : 0)) | 0,
        src_loc | 0,
        left | 0,        // data_1: object (LHS)
        index_expr | 0    // data_2: computed property (RHS)
    );

    return node | 0;
}

// ============================================================
// parse_call_expression(callee) — foo(arg1, arg2)
// ============================================================
function parse_call_expression(callee) {
    callee = callee | 0;
    const src_loc = lexer.lex_register[lexer.REG_START] | 0;

    // Consume '('
    lexer.advance();

    // Collect arguments on scratch_stack to avoid interleaving
    const scratch_base = scratch_cursor | 0;
    let arg_count = 0;

    while ((lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_RPAREN &&
           (lexer.lex_register[lexer.REG_TYPE] | 0) !== lexer.TOKEN_EOF) {

        if (arg_count > 0) {
            // Consume comma between arguments
            lexer.expect(lexer.TOKEN_COMMA);
        }

        // Reserve a scratch slot for this arg
        scratch_cursor = (scratch_base + arg_count + 1) | 0;
        const arg = parse_expression(0) | 0;
        scratch_stack[(scratch_base + arg_count) | 0] = arg | 0;
        arg_count = (arg_count + 1) | 0;
    }

    // Consume ')'
    lexer.expect(lexer.TOKEN_RPAREN);

    // Batch-push args to ast_extra after all nested parsing is done
    const extra_start = extra_cursor | 0;
    for (let i = 0; i < arg_count; i = (i + 1) | 0) {
        push_extra(scratch_stack[(scratch_base + i) | 0] | 0);
    }

    // Restore scratch cursor
    scratch_cursor = scratch_base | 0;

    // Pack arg_count into bits 16-31 of type_and_flags
    const node = alloc_node(
        (NODE_CALL_EXPRESSION | (arg_count << 16)) | 0,
        src_loc | 0,
        callee | 0,        // data_1: callee node
        extra_start | 0    // data_2: ast_extra offset for args
    );

    return node | 0;
}

// ============================================================
// Public API
// ============================================================
function get_ast_nodes()   { return ast_nodes; }
function get_ast_extra()   { return ast_extra; }
function get_intern_pool() { return intern_pool; }
function get_ast_cursor()  { return ast_cursor | 0; }
function get_extra_cursor() { return extra_cursor | 0; }
function get_intern_cursor() { return intern_cursor | 0; }

module.exports = {
    parse,

    // Arena accessors
    get_ast_nodes,
    get_ast_extra,
    get_intern_pool,
    get_ast_cursor,
    get_extra_cursor,
    get_intern_cursor,

    // Node Type Enums
    NODE_PROGRAM,
    NODE_VARIABLE_DECLARATION,
    NODE_VARIABLE_DECLARATOR,
    NODE_IDENTIFIER,
    NODE_LITERAL,
    NODE_CALL_EXPRESSION,
    NODE_EXPRESSION_STATEMENT,
    NODE_MEMBER_EXPRESSION,
    NODE_FUNCTION_DECLARATION,
    NODE_IF_STATEMENT,
    NODE_WHILE_STATEMENT,
    NODE_RETURN_STATEMENT,
    NODE_BINARY_EXPRESSION,
    NODE_BLOCK_STATEMENT,
    NODE_ARRAY_EXPRESSION,
    NODE_UNARY_EXPRESSION,
    NODE_NEW_EXPRESSION,
    NODE_THROW_STATEMENT,
    NODE_BREAK_STATEMENT,
    NODE_CONTINUE_STATEMENT,
    NODE_FOR_STATEMENT,
    NODE_ASSIGNMENT_EXPRESSION,
    NODE_UPDATE_EXPRESSION,
    NODE_OBJECT_EXPRESSION,
    NODE_PROPERTY,
    NODE_CLASS_DECLARATION,
    NODE_METHOD_DEFINITION,
    NODE_THIS_EXPRESSION,
    NODE_CONDITIONAL_EXPRESSION,

    // Flags
    FLAG_CONST, FLAG_LET, FLAG_VAR,
    FLAG_STRING, FLAG_NUMBER, FLAG_BOOLEAN, FLAG_NULL, FLAG_UNDEFINED,
    FLAG_COMPUTED, FLAG_PREFIX,

    // Struct layout
    SLOT_TYPE_FLAGS, SLOT_SOURCE_LOC, SLOT_DATA_1, SLOT_DATA_2,
    NODE_SIZE_SLOTS,
};
```

## File: compiler/src/codegen/generator-llvm.ohn

```javascript
;// compiler/src/codegen/generator-llvm.ohn
// LLVM IR Backend for the Ohnrscript Self-Hosted Compiler
// Walks the packed AST arenas and emits LLVM IR text (*.ll files).
//
// STRATEGY: alloca/mem2reg
//   Every local variable gets an alloca in the function entry block.
//   All reads emit a 'load', all writes emit a 'store'.
//   LLVM's own mem2reg pass (run by clang/opt -O1+) promotes these
//   to true SSA phi nodes — we never construct phi nodes manually.
//
// FIRST-PASS SCOPE (ohn-vector target):
//   Handles 10 node types. All others emit '; UNSUPPORTED' and continue.
//
// CRITICAL CONSTRAINT: No string concatenation in the hot path!
//   All static text is pre-allocated as Buffer constants.
//   All output flows through emitter.emit(buffer, offset, length).

'use strict';

const emitter_mod = require('./emitter.ohn');
const Emitter = emitter_mod.Emitter;

// ============================================================
// Pre-allocated Static LLVM IR Byte Buffers (Zero-Copy I/O)
// ============================================================

// Module header
const LLVM_HEADER = Buffer.from('; Ohnrscript LLVM IR Backend\n; generated by generator-llvm.ohn\n\n');
const LLVM_DECLARE_F32 = Buffer.from('declare ptr @ohn_alloc_f32(i32)\ndeclare void @ohn_free(ptr)\n\n');

// Function definition (opaque pointer: LLVM 15+ / Apple clang 15+)
const LLVM_DEFINE_I32 = Buffer.from('define i32 @');
const LLVM_DEFINE_VOID = Buffer.from('define void @');
const LLVM_DEFINE_PTR = Buffer.from('define ptr @');   // was float*
const LLVM_FUNC_ARGS = Buffer.from('(');
const LLVM_FUNC_OPEN = Buffer.from(') {\nentry:\n');
const LLVM_FUNC_CLOSE = Buffer.from('}\n\n');

// Basic blocks
const LLVM_LABEL_COLON = Buffer.from(':\n');

// Alloca (opaque ptr — no type on the alloca itself in ptr mode)
// Note: alloca always returns ptr in opaque pointer mode.
const LLVM_ALLOCA_I32 = Buffer.from('  %');
const LLVM_ALLOCA_SFX = Buffer.from(' = alloca i32\n');
const LLVM_ALLOCA_PTR = Buffer.from(' = alloca ptr\n');  // was alloca float*

// Load (opaque ptr: 'load i32, ptr %name')
const LLVM_LOAD_I32_PFX = Buffer.from('  %t');
const LLVM_LOAD_I32_MID = Buffer.from(' = load i32, ptr %');
const LLVM_LOAD_I32_NL = Buffer.from('\n');
const LLVM_LOAD_PTR_MID = Buffer.from(' = load ptr, ptr %');  // was load float*, float** %

// Store (opaque ptr: 'store i32 val, ptr %name')
const LLVM_STORE_I32 = Buffer.from('  store i32 ');
const LLVM_STORE_PTR = Buffer.from('  store ptr ');      // was store float*
const LLVM_STORE_TO = Buffer.from(', ptr %');           // was , i32* % or , float** %
const LLVM_STORE_TO_T = Buffer.from(', ptr %t');          // for GEP result targets
const LLVM_STORE_NL = Buffer.from('\n');

// Arithmetic instructions
const LLVM_ADD = Buffer.from(' = add i32 ');
const LLVM_SUB = Buffer.from(' = sub i32 ');
const LLVM_MUL = Buffer.from(' = mul i32 ');
const LLVM_SDIV = Buffer.from(' = sdiv i32 ');
const LLVM_SREM = Buffer.from(' = srem i32 ');
const LLVM_OR = Buffer.from(' = or i32 ');
const LLVM_AND = Buffer.from(' = and i32 ');
const LLVM_XOR = Buffer.from(' = xor i32 ');
const LLVM_SHL = Buffer.from(' = shl i32 ');
const LLVM_ASHR = Buffer.from(' = ashr i32 ');
const LLVM_LSHR = Buffer.from(' = lshr i32 ');

// Float arithmetic
const LLVM_FADD = Buffer.from(' = fadd float ');
const LLVM_FMUL = Buffer.from(' = fmul float ');

// Comparisons
const LLVM_ICMP_EQ = Buffer.from(' = icmp eq i32 ');
const LLVM_ICMP_NE = Buffer.from(' = icmp ne i32 ');
const LLVM_ICMP_SLT = Buffer.from(' = icmp slt i32 ');
const LLVM_ICMP_SGT = Buffer.from(' = icmp sgt i32 ');
const LLVM_ICMP_SLE = Buffer.from(' = icmp sle i32 ');
const LLVM_ICMP_SGE = Buffer.from(' = icmp sge i32 ');

// Logical (operate on already-zext'd i32 values, not raw i1)
const LLVM_LOG_AND = Buffer.from(' = and i32 ');
const LLVM_LOG_OR = Buffer.from(' = or i32 ');

// Zero-extend i1 boolean → i32 (used after every comparison/logical op)
const LLVM_ZEXT_I1_I32 = Buffer.from(' = zext i1 %t');
const LLVM_ZEXT_SFX = Buffer.from(' to i32\n');

// Truncate i32 → i1 for branch conditions (icmp ne i32 %val, 0)
const LLVM_TRUNC_I32_I1 = Buffer.from(' = icmp ne i32 %t');
const LLVM_TRUNC_ZERO = Buffer.from(', 0\n');

// Lazy module init getter global state
const LLVM_GLOBAL_I1_0 = Buffer.from(' = global i1 0\n');
const LLVM_GLOBAL_PTR_NULL = Buffer.from(' = global ptr null\n');
const LLVM_AT = Buffer.from('@');

// Lazy getter control flow labels
const LLVM_INIT_BLOCK = Buffer.from('init_block:\n');
const LLVM_RETURN_BLOCK = Buffer.from('return_block:\n');
const LLVM_STORE_I1_1 = Buffer.from('  store i1 1, ptr @');
const LLVM_STORE_PTR_GLOBAL = Buffer.from('  store ptr ');
const LLVM_LOAD_GLOBAL_I1 = Buffer.from('  %init_flag = load i1, ptr @');
const LLVM_BR_INIT = Buffer.from('  br i1 %init_flag, label %return_block, label %init_block\n');
const LLVM_LOAD_EXPORTS = Buffer.from('  %exports_val = load ptr, ptr @');
const LLVM_RET_EXPORTS = Buffer.from('  ret ptr %exports_val\n');
const LLVM_DEFINE_GET = Buffer.from('define ptr @__get_module_exports_');
const LLVM_CALL_GET_PFX = Buffer.from(' = call ptr @__get_module_exports_');

// Branches
const LLVM_BR = Buffer.from('  br label %');
const LLVM_BR_NL = Buffer.from('\n');
const LLVM_BR_COND_PFX = Buffer.from('  br i1 %t');
const LLVM_BR_COND_TRUE = Buffer.from(', label %');
const LLVM_BR_COND_FALSE = Buffer.from(', label %');

// Return
const LLVM_RET_I32 = Buffer.from('  ret i32 ');
const LLVM_RET_VOID = Buffer.from('  ret void\n');
const LLVM_RET_PTR = Buffer.from('  ret ptr %t');  // was ret float* %t
const LLVM_RET_NL = Buffer.from('\n');

// GEP (opaque ptr: 'getelementptr i32, ptr %tN, i32 %tM')
const LLVM_GEP_I32_PFX = Buffer.from(' = getelementptr i32, ptr %t');
const LLVM_GEP_F32_PFX = Buffer.from(' = getelementptr float, ptr %t');
const LLVM_GEP_IDX = Buffer.from(', i32 %t');
const LLVM_GEP_NL = Buffer.from('\n');

// Load via GEP result (opaque ptr)
const LLVM_LOAD_PTR_I32 = Buffer.from(' = load i32, ptr %t');
const LLVM_LOAD_PTR_F32 = Buffer.from(' = load float, ptr %t');

// Store via GEP result
const LLVM_STORE_F32_TO = Buffer.from('  store float ');
const LLVM_STORE_F32_PTR = Buffer.from(', ptr %t');   // was , float* %t

// Bitcast (i32 bits → float for Float32Array element writes)
const LLVM_BITCAST_I2F = Buffer.from(' = bitcast i32 %t');
const LLVM_BITCAST_SFX = Buffer.from(' to float\n');

// Call
const LLVM_CALL_PTR = Buffer.from(' = call ptr @ohn_alloc_f32(i32 %t');  // was call float*
const LLVM_CALL_RPAREN = Buffer.from(')\n');

// Update (increment/decrement)
const LLVM_INC_SFX = Buffer.from(' = add i32 1, %t');
const LLVM_DEC_SFX = Buffer.from(' = sub i32 %t');
const LLVM_DEC_ONE = Buffer.from(', 1\n');

// Punctuation
const LLVM_COMMA_SPACE = Buffer.from(', ');
const LLVM_SPACE = Buffer.from(' ');
const LLVM_NEWLINE = Buffer.from('\n');
const LLVM_TWO_SPACES = Buffer.from('  ');
const LLVM_PERCENT = Buffer.from('%');
const LLVM_PERCENT_T = Buffer.from('%t');

// Params: all params are i64 on 64-bit targets (ARM64 / x86-64)
// i64 is ABI-compatible for both integer values and pointer values.
// The caller zero-extends int args; pointer args are full 64-bit addresses.
const LLVM_PARAM_I32 = Buffer.from('i64 %');
const LLVM_PARAM_PTR = Buffer.from('ptr %');  // was float* %

// Unsupported node comment
const LLVM_UNSUPPORTED = Buffer.from('  ; UNSUPPORTED node type: 0x');

// ============================================================
// Node Type Constants (must match parser.ohn exactly)
// ============================================================
const NODE_PROGRAM = 0x00;
const NODE_VARIABLE_DECLARATION = 0x01;
const NODE_VARIABLE_DECLARATOR = 0x02;
const NODE_IDENTIFIER = 0x03;
const NODE_LITERAL = 0x04;
const NODE_CALL_EXPRESSION = 0x05;
const NODE_EXPRESSION_STATEMENT = 0x06;
const NODE_MEMBER_EXPRESSION = 0x07;
const NODE_FUNCTION_DECLARATION = 0x08;
const NODE_IF_STATEMENT = 0x09;
const NODE_WHILE_STATEMENT = 0x0A;
const NODE_RETURN_STATEMENT = 0x0B;
const NODE_BINARY_EXPRESSION = 0x0C;
const NODE_BLOCK_STATEMENT = 0x0D;
const NODE_ARRAY_EXPRESSION = 0x0E;
const NODE_UNARY_EXPRESSION = 0x0F;
const NODE_NEW_EXPRESSION = 0x10;
const NODE_THROW_STATEMENT = 0x11;
const NODE_BREAK_STATEMENT = 0x12;
const NODE_CONTINUE_STATEMENT = 0x13;
const NODE_FOR_STATEMENT = 0x14;
const NODE_ASSIGNMENT_EXPRESSION = 0x15;
const NODE_UPDATE_EXPRESSION = 0x16;
const NODE_OBJECT_EXPRESSION = 0x17;
const NODE_PROPERTY = 0x18;
const NODE_CLASS_DECLARATION = 0x19;
const NODE_METHOD_DEFINITION = 0x1A;
const NODE_THIS_EXPRESSION = 0x1B;
const NODE_CONDITIONAL_EXPRESSION = 0x1C;

// ============================================================
// Flags (must match parser.ohn exactly)
// ============================================================
const FLAG_CONST = 0x0100;
const FLAG_LET = 0x0200;
const FLAG_VAR = 0x0400;
const FLAG_STRING = 0x0100;
const FLAG_NUMBER = 0x0200;
const FLAG_BOOLEAN = 0x0400;
const FLAG_NULL = 0x0800;
const FLAG_UNDEFINED = 0x1000;
const FLAG_COMPUTED = 0x0100;
const FLAG_PREFIX = 0x0100;
const FLAG_FLOAT = 0x2000; // LLVM backend: Float32Array element type

// ============================================================
// Token constants for operator lookup (must match lexer.ohn)
// ============================================================
const TOKEN_ASSIGN = 40;
const TOKEN_STRICT_EQ = 60;
const TOKEN_STRICT_NEQ = 61;
const TOKEN_LT = 62;
const TOKEN_GT = 63;
const TOKEN_LTE = 64;
const TOKEN_GTE = 65;
const TOKEN_PLUS = 70;
const TOKEN_MINUS = 71;
const TOKEN_MUL = 72;
const TOKEN_DIV = 73;
const TOKEN_MOD = 74;
const TOKEN_BIT_OR = 80;
const TOKEN_BIT_XOR = 81;
const TOKEN_BIT_AND = 82;
const TOKEN_LSHIFT = 83;
const TOKEN_RSHIFT = 84;
const TOKEN_URSHIFT = 85;
const TOKEN_LOGICAL_OR = 91;
const TOKEN_LOGICAL_AND = 92;
const TOKEN_PLUS_ASSIGN = 100;
const TOKEN_MINUS_ASSIGN = 101;
const TOKEN_MUL_ASSIGN = 102;
const TOKEN_DIV_ASSIGN = 103;
const TOKEN_MOD_ASSIGN = 104;
const TOKEN_OR_ASSIGN = 105;
const TOKEN_AND_ASSIGN = 106;
const TOKEN_XOR_ASSIGN = 107;
const TOKEN_INCREMENT = 110;
const TOKEN_DECREMENT = 111;

// ============================================================
// Scratch buffer for integer-to-ASCII conversion
// ============================================================
const num_scratch = Buffer.alloc(24);
const hex_scratch = Buffer.alloc(16);
const HEX_CHARS = Buffer.from('0123456789abcdef');

function int_to_ascii(value) {
    value = value | 0;
    if (value === 0) {
        num_scratch[0] = 48;
        return 1;
    }
    let negative = false;
    if (value < 0) {
        negative = true;
        value = (-value) | 0;
    }
    let pos = 23;
    while (value > 0) {
        num_scratch[pos] = ((value % 10) + 48) | 0;
        value = (value / 10) | 0;
        pos = (pos - 1) | 0;
    }
    if (negative) {
        num_scratch[pos] = 45;
        pos = (pos - 1) | 0;
    }
    const start = (pos + 1) | 0;
    const len = (24 - start) | 0;
    for (let i = 0; i < len; i = (i + 1) | 0) {
        num_scratch[i] = num_scratch[(start + i) | 0];
    }
    return len | 0;
}

function int_to_hex(value) {
    value = value | 0;
    if (value === 0) {
        hex_scratch[0] = 48;
        return 1;
    }
    let uval = value >>> 0;
    let pos = 15;
    while (uval > 0) {
        hex_scratch[pos] = HEX_CHARS[uval & 0xF];
        uval = uval >>> 4;
        pos = (pos - 1) | 0;
    }
    const start = (pos + 1) | 0;
    const len = (16 - start) | 0;
    for (let i = 0; i < len; i = (i + 1) | 0) {
        hex_scratch[i] = hex_scratch[(start + i) | 0];
    }
    return len | 0;
}

// ============================================================
// generate() — Public API (same signature as generator.ohn)
// ============================================================
function generate(ast_nodes, ast_extra, intern_pool, root_index, outputPath) {
    const emitter = new Emitter(outputPath);

    // ============================================================
    // Per-function state
    // ============================================================
    let tmp_counter = 0;  // SSA temp counter — increments monotonically
    let block_counter = 0;  // Basic block counter for unique labels

    // param_set: intern offsets of current function's parameters.
    // Parameters are SSA values already in registers — they do NOT have allocas
    // and do NOT need load instructions. Reference them directly as '%name'.
    // Local variables (from VariableDeclaration) DO have allocas and need loads.
    // We track this as a plain JS object (key = intern_off as string → true).
    let param_set = {};

    // global_set: intern offsets of module-level (top-level) variables.
    // These are emitted as LLVM globals (@name) rather than local allocas (%name).
    // Any function in the module can load/store them via 'load i32, ptr @name'.
    let global_set = {};

    // Helper: emit current tmp counter value, return it, then increment
    function next_tmp() {
        const t = tmp_counter | 0;
        tmp_counter = (tmp_counter + 1) | 0;
        return t | 0;
    }

    // Helper: emit current block counter, return it, then increment
    function next_block() {
        const b = block_counter | 0;
        block_counter = (block_counter + 1) | 0;
        return b | 0;
    }

    // Helper: emit '  %t<N>' prefix for an instruction result
    function emit_tmp_def(t) {
        t = t | 0;
        emitter.emit(LLVM_TWO_SPACES, 0, 2);
        emitter.emit(LLVM_PERCENT_T, 0, 2);
        const len = int_to_ascii(t) | 0;
        emitter.emit(num_scratch, 0, len);
    }

    // Helper: emit '%t<N>' reference inline (no leading spaces)
    function emit_tmp_ref(t) {
        t = t | 0;
        emitter.emit(LLVM_PERCENT_T, 0, 2);
        const len = int_to_ascii(t) | 0;
        emitter.emit(num_scratch, 0, len);
    }

    // Helper: emit a label name like 'loop.3'
    function emit_label(name_buf, n) {
        n = n | 0;
        emitter.emit(name_buf, 0, name_buf.length);
        const len = int_to_ascii(n) | 0;
        emitter.emit(num_scratch, 0, len);
    }

    // Helper: read a null-terminated identifier from intern pool
    function intern_length(offset) {
        offset = offset | 0;
        let len = 0;
        while (intern_pool[(offset + len) | 0] !== 0) {
            len = (len + 1) | 0;
        }
        return len | 0;
    }

    // ============================================================
    // Alloca tracking: we emit all allocas at function entry.
    // We collect them during the function body walk via a flag.
    // For simplicity in the first pass: emit alloca inline at
    // first VariableDeclaration encounter (entry block is first).
    // ============================================================

    // emit_alloca: writes '  %name = alloca i32\n' or '  %name = alloca ptr\n'
    function emit_alloca(intern_off, is_ptr) {
        intern_off = intern_off | 0;
        emitter.emit(LLVM_ALLOCA_I32, 0, LLVM_ALLOCA_I32.length); // '  %'
        const len = intern_length(intern_off) | 0;
        emitter.emit(intern_pool, intern_off, len);
        if (is_ptr) {
            emitter.emit(LLVM_ALLOCA_PTR, 0, LLVM_ALLOCA_PTR.length);
        } else {
            emitter.emit(LLVM_ALLOCA_SFX, 0, LLVM_ALLOCA_SFX.length);
        }
    }

    // emit_load_i32: loads a named value into an i32 SSA temp.
    // For local i32 allocas:   'load i32, ptr %name'
    // For i64 parameters:      'trunc i64 %name to i32'  (LLVM eliminates this on ARM64)
    function emit_load_i32(intern_off) {
        intern_off = intern_off | 0;
        const t = next_tmp() | 0;
        emitter.emit(LLVM_LOAD_I32_PFX, 0, LLVM_LOAD_I32_PFX.length); // '  %t'
        let len = int_to_ascii(t) | 0;
        emitter.emit(num_scratch, 0, len);
        if (global_set[intern_off]) {
            // Module-level global: 'load i32, ptr @name'
            emitter.emit(Buffer.from(' = load i32, ptr @'), 0, 18);
            len = intern_length(intern_off) | 0;
            emitter.emit(intern_pool, intern_off, len);
            emitter.emit(LLVM_LOAD_I32_NL, 0, 1);
        } else if (param_set[intern_off]) {
            // i64 parameter — truncate to i32 for arithmetic
            emitter.emit(Buffer.from(' = trunc i64 %'), 0, 14);
            len = intern_length(intern_off) | 0;
            emitter.emit(intern_pool, intern_off, len);
            emitter.emit(Buffer.from(' to i32\n'), 0, 8);
        } else {
            emitter.emit(LLVM_LOAD_I32_MID, 0, LLVM_LOAD_I32_MID.length); // ' = load i32, ptr %'
            len = intern_length(intern_off) | 0;
            emitter.emit(intern_pool, intern_off, len);
            emitter.emit(LLVM_LOAD_I32_NL, 0, 1);
        }
        return t | 0;
    }

    // emit_load_ptr: emits '  %t<N> = load ptr, ptr %name\n' for local ptr vars, returns t
    //                or    '  %t<N> = add i32 0, %name\n'     for parameters
    // Used for loading a pointer from a pointer-typed alloca (Float32Array vars, etc.)
    function emit_load_ptr(intern_off) {
        intern_off = intern_off | 0;
        const t = next_tmp() | 0;
        emitter.emit(LLVM_LOAD_I32_PFX, 0, LLVM_LOAD_I32_PFX.length); // '  %t'
        let len = int_to_ascii(t) | 0;
        emitter.emit(num_scratch, 0, len);
        if (global_set[intern_off]) {
            // Module-level global ptr: 'load ptr, ptr @name'
            emitter.emit(Buffer.from(' = load ptr, ptr @'), 0, 18);
        } else if (param_set[intern_off]) {
            // Parameter: already an SSA value
            emitter.emit(Buffer.from(' = add i32 0, %'), 0, 15);
        } else {
            emitter.emit(LLVM_LOAD_PTR_MID, 0, LLVM_LOAD_PTR_MID.length);  // ' = load ptr, ptr %'
        }
        len = intern_length(intern_off) | 0;
        emitter.emit(intern_pool, intern_off, len);
        emitter.emit(LLVM_LOAD_I32_NL, 0, 1);
        return t | 0;
    }

    // emit_load_as_ptr: load an identifier value as a LLVM 'ptr' type for use as a GEP base.
    // GEP requires a ptr operand — this handles both cases:
    //   - i64 parameter (64-bit address): inttoptr i64 %name to ptr  (one instruction)
    //   - local ptr alloca: load ptr, ptr %name
    function emit_load_as_ptr(intern_off) {
        intern_off = intern_off | 0;
        if (global_set[intern_off]) {
            // Module-level global (holds a ptr): 'load ptr, ptr @name'
            const t = next_tmp() | 0;
            emitter.emit(LLVM_LOAD_I32_PFX, 0, LLVM_LOAD_I32_PFX.length);
            let len = int_to_ascii(t) | 0;
            emitter.emit(num_scratch, 0, len);
            emitter.emit(Buffer.from(' = load ptr, ptr @'), 0, 18);
            len = intern_length(intern_off) | 0;
            emitter.emit(intern_pool, intern_off, len);
            emitter.emit(LLVM_LOAD_I32_NL, 0, 1);
            return t | 0;
        }
        if (param_set[intern_off]) {
            // i64 parameter holding a 64-bit address — inttoptr directly
            const ptr_t = next_tmp() | 0;
            emitter.emit(LLVM_LOAD_I32_PFX, 0, LLVM_LOAD_I32_PFX.length); // '  %t'
            let len = int_to_ascii(ptr_t) | 0;
            emitter.emit(num_scratch, 0, len);
            emitter.emit(Buffer.from(' = inttoptr i64 %'), 0, 17);
            len = intern_length(intern_off) | 0;
            emitter.emit(intern_pool, intern_off, len);
            emitter.emit(Buffer.from(' to ptr\n'), 0, 8);
            return ptr_t | 0;
        }
        // Local ptr alloca: load ptr, ptr %name
        const t = next_tmp() | 0;
        emitter.emit(LLVM_LOAD_I32_PFX, 0, LLVM_LOAD_I32_PFX.length);
        let len = int_to_ascii(t) | 0;
        emitter.emit(num_scratch, 0, len);
        emitter.emit(LLVM_LOAD_PTR_MID, 0, LLVM_LOAD_PTR_MID.length);
        len = intern_length(intern_off) | 0;
        emitter.emit(intern_pool, intern_off, len);
        emitter.emit(LLVM_LOAD_I32_NL, 0, 1);
        return t | 0;
    }

    // ============================================================
    // walk(idx) — main recursive AST walker
    // Returns: the SSA temp register number holding the result value,
    //          or -1 if the node is a statement (no value).
    // ============================================================
    function walk(idx) {
        idx = idx | 0;
        if (idx < 0) return -1;

        const tf = ast_nodes[idx] | 0;
        const base = tf & 0xFF;
        const d1 = ast_nodes[(idx + 2) | 0] | 0;
        const d2 = ast_nodes[(idx + 3) | 0] | 0;
        const is_float = (tf & FLAG_FLOAT) !== 0;

        // ── Program (0x00) ──
        if (base === NODE_PROGRAM) {
            // Emit module header and runtime declarations
            emitter.emit(LLVM_HEADER, 0, LLVM_HEADER.length);
            emitter.emit(LLVM_DECLARE_F32, 0, LLVM_DECLARE_F32.length);

            const child_count = d1 | 0;
            const extra_start = d2 | 0;

            // Collect top-level variable names for global state
            // and separate function declarations from top-level statements
            const top_stmts = [];
            const top_fns = [];
            for (let i = 0; i < child_count; i = (i + 1) | 0) {
                const ci = ast_extra[(extra_start + i) | 0] | 0;
                const ci_tf = ast_nodes[ci] | 0;
                const ci_base = ci_tf & 0xFF;
                if (ci_base === NODE_FUNCTION_DECLARATION) {
                    top_fns.push(ci);
                } else {
                    top_stmts.push(ci);
                }
            }

            // If there are top-level statements, generate the Lazy Getter pattern.
            // Global state: @<mod>_initialized = global i1 0
            //               @<mod>_exports     = global ptr null
            if (top_stmts.length > 0) {
                // Derive a simple module name from the output path
                const mod_name_raw = outputPath
                    .replace(/.*\//, '')
                    .replace(/\.ll$/, '')
                    .replace(/[^a-zA-Z0-9_]/g, '_');
                const mod_name_buf = Buffer.from(mod_name_raw);
                const mod_init_flag = Buffer.from('@' + mod_name_raw + '_initialized');
                const mod_exports = Buffer.from('@' + mod_name_raw + '_exports');

                // PASS 1: Collect all top-level variable names.
                // Register them in global_set so Identifier/VariableDeclarator use @name not %name.
                const tl_seen = {};
                function collect_tl_globals(ci) {
                    ci = ci | 0;
                    if (ci < 0) return;
                    const cf = ast_nodes[ci] | 0;
                    const cb = cf & 0xFF;
                    const cd1 = ast_nodes[(ci + 2) | 0] | 0;
                    const cd2 = ast_nodes[(ci + 3) | 0] | 0;
                    if (cb === NODE_VARIABLE_DECLARATOR) {
                        const vn_node = cd1 | 0;
                        const vn_off = ast_nodes[(vn_node + 2) | 0] | 0;
                        const key = String(vn_off);
                        if (!tl_seen[key]) {
                            tl_seen[key] = vn_off; // store numeric offset for emit pass
                            global_set[vn_off] = true; // mark as global for load/store handlers
                        }
                        return;
                    }
                    if (cb === NODE_VARIABLE_DECLARATION) {
                        const cc = cd1 | 0;
                        const ce = cd2 | 0;
                        for (let ci2 = 0; ci2 < cc; ci2 = (ci2 + 1) | 0) {
                            collect_tl_globals(ast_extra[(ce + ci2) | 0] | 0);
                        }
                    }
                }
                for (let si = 0; si < top_stmts.length; si = (si + 1) | 0) {
                    collect_tl_globals(top_stmts[si]);
                }

                // PASS 2: Emit module init/exports globals
                emitter.emit(mod_init_flag, 0, mod_init_flag.length);
                emitter.emit(LLVM_GLOBAL_I1_0, 0, LLVM_GLOBAL_I1_0.length);
                emitter.emit(mod_exports, 0, mod_exports.length);
                emitter.emit(LLVM_GLOBAL_PTR_NULL, 0, LLVM_GLOBAL_PTR_NULL.length);

                // PASS 3: Emit all top-level variables as LLVM globals (before the getter function)
                // e.g.  @POOL_SIZE = global i32 0
                const tl_offsets = Object.values(tl_seen);
                for (let gi = 0; gi < tl_offsets.length; gi++) {
                    const vn_off = tl_offsets[gi];
                    emitter.emit(LLVM_AT, 0, 1); // '@'
                    const vlen = intern_length(vn_off) | 0;
                    emitter.emit(intern_pool, vn_off, vlen);
                    emitter.emit(Buffer.from(' = global i32 0\n'), 0, 16);
                }
                emitter.emit(LLVM_NEWLINE, 0, 1);

                // Reset counters for the synthetic getter function scope
                tmp_counter = 0;
                block_counter = 0;
                param_set = {};

                // Emit getter: define ptr @__get_module_exports_<mod>()
                emitter.emit(LLVM_DEFINE_GET, 0, LLVM_DEFINE_GET.length);
                emitter.emit(mod_name_buf, 0, mod_name_buf.length);
                emitter.emit(Buffer.from('() {\nentry:\n'), 0, 12);

                // Load flag and branch
                emitter.emit(LLVM_LOAD_GLOBAL_I1, 0, LLVM_LOAD_GLOBAL_I1.length);
                const flag_name_raw = mod_name_raw + '_initialized';
                emitter.emit(Buffer.from(flag_name_raw), 0, flag_name_raw.length);
                emitter.emit(LLVM_NEWLINE, 0, 1);
                emitter.emit(LLVM_BR_INIT, 0, LLVM_BR_INIT.length);

                // init_block:
                emitter.emit(LLVM_INIT_BLOCK, 0, LLVM_INIT_BLOCK.length);
                // Immediately mark initialized (circular dep safety)
                emitter.emit(LLVM_STORE_I1_1, 0, LLVM_STORE_I1_1.length);
                emitter.emit(Buffer.from(flag_name_raw), 0, flag_name_raw.length);
                emitter.emit(LLVM_NEWLINE, 0, 1);

                // Emit top-level statements — stores computed values into the globals
                for (let si = 0; si < top_stmts.length; si = (si + 1) | 0) {
                    walk(top_stmts[si]);
                }

                // Store exports pointer (placeholder — real exports need a struct type)
                const en = mod_name_raw + '_exports';
                const en_global = '@' + en;
                const store_line = Buffer.from('  store ptr null, ptr ' + en_global + '\n');
                emitter.emit(store_line, 0, store_line.length);
                emitter.emit(Buffer.from('  br label %return_block\n'), 0, 25);

                // return_block:
                emitter.emit(LLVM_RETURN_BLOCK, 0, LLVM_RETURN_BLOCK.length);
                // LLVM_LOAD_EXPORTS = '  %exports_val = load ptr, ptr @'
                emitter.emit(LLVM_LOAD_EXPORTS, 0, LLVM_LOAD_EXPORTS.length);
                emitter.emit(Buffer.from(en), 0, en.length);
                emitter.emit(LLVM_NEWLINE, 0, 1);
                emitter.emit(LLVM_RET_EXPORTS, 0, LLVM_RET_EXPORTS.length);
                emitter.emit(LLVM_FUNC_CLOSE, 0, LLVM_FUNC_CLOSE.length);
            }

            // Emit top-level function declarations normally
            for (let fi = 0; fi < top_fns.length; fi = (fi + 1) | 0) {
                walk(top_fns[fi]);
            }

            return -1;
        }

        // ── FunctionDeclaration (0x08) ──
        if (base === NODE_FUNCTION_DECLARATION) {
            // d1 = name Identifier node index
            // d2 = extra_start: [param_count, param_node_0, ..., body_idx]
            const name_node = d1 | 0;
            const extra_start = d2 | 0;
            const param_count = ast_extra[extra_start] | 0;
            const body_idx = ast_extra[(extra_start + 1 + param_count) | 0] | 0;

            // Read the intern offset from the Identifier node (its SLOT_DATA_1)
            const name_off = ast_nodes[(name_node + 2) | 0] | 0;

            // Reset per-function SSA and block counters for readable IR
            tmp_counter = 0;
            block_counter = 0;
            param_set = {}; // clear previous function's params

            // ── ALLOCA HOISTING: pre-walk body to collect all variable names ──
            // LLVM's mem2reg requires ALL allocas to be in the entry block.
            // We do a depth-first pre-walk, collecting every VariableDeclarator
            // name and emitting allocas before any instructions.
            let alloca_counter = 0;
            const alloca_seen = {}; // guard against duplicate names
            function collect_allocas(ci) {
                ci = ci | 0;
                if (ci < 0) return;
                const cf = ast_nodes[ci] | 0;
                const cb = cf & 0xFF;
                const cd1 = ast_nodes[(ci + 2) | 0] | 0;
                const cd2 = ast_nodes[(ci + 3) | 0] | 0;

                if (cb === NODE_VARIABLE_DECLARATOR) {
                    const vname_node = cd1 | 0;
                    const vname_off = ast_nodes[(vname_node + 2) | 0] | 0;
                    const vname_len = intern_length(vname_off) | 0;
                    // Build a unique key from name + monotonic counter to handle shadowing
                    const key = String(vname_off);
                    if (!alloca_seen[key]) {
                        alloca_seen[key] = true;
                        // Check if init is a Float32Array new expression
                        const init_idx = cd2 | 0;
                        let is_ptr = false;
                        if (init_idx >= 0) {
                            const init_tf = ast_nodes[init_idx] | 0;
                            if (((init_tf & 0xFF) === NODE_NEW_EXPRESSION) && ((init_tf & FLAG_FLOAT) !== 0)) {
                                is_ptr = true;
                            }
                        }
                        emit_alloca(vname_off, is_ptr);
                    }
                    alloca_counter = (alloca_counter + 1) | 0;
                    return;
                }

                // Recurse into child nodes
                if (cb === NODE_BLOCK_STATEMENT || cb === NODE_FUNCTION_DECLARATION) {
                    // For nested functions, do NOT descend — they have their own scope
                    if (cb === NODE_FUNCTION_DECLARATION) return;
                    const cc = cd1 | 0;
                    const ce = cd2 | 0;
                    for (let ci2 = 0; ci2 < cc; ci2 = (ci2 + 1) | 0) {
                        collect_allocas(ast_extra[(ce + ci2) | 0] | 0);
                    }
                } else if (cb === NODE_IF_STATEMENT) {
                    const ce = cd2 | 0;
                    collect_allocas(ast_extra[ce] | 0);
                    collect_allocas(ast_extra[(ce + 1) | 0] | 0);
                } else if (cb === NODE_WHILE_STATEMENT) {
                    collect_allocas(cd2 | 0);
                } else if (cb === NODE_FOR_STATEMENT) {
                    // Parser layout: d1=extra_start [init,test,update], d2=body
                    const ce = cd1 | 0;
                    collect_allocas(ast_extra[ce] | 0);       // init
                    collect_allocas(cd2 | 0);                  // body
                } else if (cb === NODE_VARIABLE_DECLARATION) {
                    const cc = cd1 | 0;
                    const ce = cd2 | 0;
                    for (let ci2 = 0; ci2 < cc; ci2 = (ci2 + 1) | 0) {
                        collect_allocas(ast_extra[(ce + ci2) | 0] | 0);
                    }
                }
            }

            // Emit function signature: 'define i32 @name('
            emitter.emit(LLVM_DEFINE_I32, 0, LLVM_DEFINE_I32.length);
            let nlen = intern_length(name_off) | 0;
            emitter.emit(intern_pool, name_off, nlen);
            emitter.emit(LLVM_FUNC_ARGS, 0, 1); // '('

            // Emit parameters and record them in param_set
            for (let pi = 0; pi < param_count; pi = (pi + 1) | 0) {
                if (pi > 0) emitter.emit(LLVM_COMMA_SPACE, 0, 2);
                const param_node = ast_extra[(extra_start + 1 + pi) | 0] | 0;
                const param_name_off = ast_nodes[(param_node + 2) | 0] | 0;
                // Record in param_set so Identifier handler knows not to emit a load
                param_set[param_name_off] = true;
                emitter.emit(LLVM_PARAM_I32, 0, LLVM_PARAM_I32.length); // 'i64 %'
                const plen = intern_length(param_name_off) | 0;
                emitter.emit(intern_pool, param_name_off, plen);
            }

            emitter.emit(LLVM_FUNC_OPEN, 0, LLVM_FUNC_OPEN.length); // ') {\nentry:\n'

            // Hoist all allocas to the entry block (LLVM mem2reg requirement)
            collect_allocas(body_idx);

            // Walk function body
            walk(body_idx);

            // Emit implicit fallthrough terminator.
            // LLVM requires every basic block to end with a terminator.
            // Functions with no explicit return (or paths that fall off the end)
            // need a 'ret i32 0' so llvm-as doesn't reject the IR.
            emitter.emit(Buffer.from('  ret i32 0\n'), 0, 12);

            emitter.emit(LLVM_FUNC_CLOSE, 0, LLVM_FUNC_CLOSE.length); // '}\n\n'
            return -1;
        }

        // ── BlockStatement (0x0D) ──
        if (base === NODE_BLOCK_STATEMENT) {
            const child_count = d1 | 0;
            const extra_start = d2 | 0;
            for (let i = 0; i < child_count; i = (i + 1) | 0) {
                walk(ast_extra[(extra_start + i) | 0] | 0);
            }
            return -1;
        }

        // ── ExpressionStatement (0x06) ──
        if (base === NODE_EXPRESSION_STATEMENT) {
            // Skip 'use strict' directives — they are string literals as ExpressionStatements
            // at the top of program/function bodies. LLVM IR does not need them.
            const inner_tf = ast_nodes[d1] | 0;
            const inner_base = inner_tf & 0xFF;
            if (inner_base === NODE_LITERAL && (inner_tf & FLAG_STRING) !== 0) {
                return -1; // skip string expression statements
            }
            walk(d1);
            return -1;
        }

        // ── VariableDeclaration (0x01) ──
        if (base === NODE_VARIABLE_DECLARATION) {
            // d1 = declarator_count, d2 = extra_start (array of declarator indices)
            const decl_count = d1 | 0;
            const extra_start = d2 | 0;
            for (let i = 0; i < decl_count; i = (i + 1) | 0) {
                walk(ast_extra[(extra_start + i) | 0] | 0);
            }
            return -1;
        }

        // ── VariableDeclarator (0x02) ──
        // d1 = name_intern_offset (via identifier node), d2 = init_idx
        // NOTE: Alloca is now hoisted to function entry block by collect_allocas().
        // We only emit the store for the initializer value here.
        if (base === NODE_VARIABLE_DECLARATOR) {
            const name_node = d1 | 0;
            const init_idx = d2 | 0;
            const name_off = ast_nodes[(name_node + 2) | 0] | 0;

            // Check if init is a Float32Array NewExpression
            let init_is_float_ptr = false;
            if (init_idx >= 0) {
                const init_tf = ast_nodes[init_idx] | 0;
                if (((init_tf & 0xFF) === NODE_NEW_EXPRESSION) && ((init_tf & FLAG_FLOAT) !== 0)) {
                    init_is_float_ptr = true;
                }
            }

            // Evaluate initializer and store (alloca already emitted by collect_allocas)
            if (init_idx >= 0) {
                const val_t = walk(init_idx) | 0;
                if (val_t >= 0) {
                    if (global_set[name_off]) {
                        // Top-level global: store i32 %t<N>, ptr @name
                        emitter.emit(Buffer.from('  store i32 '), 0, 12);
                        emit_tmp_ref(val_t);
                        emitter.emit(Buffer.from(', ptr @'), 0, 7);
                        const nlen2 = intern_length(name_off) | 0;
                        emitter.emit(intern_pool, name_off, nlen2);
                        emitter.emit(LLVM_STORE_NL, 0, 1);
                    } else if (init_is_float_ptr) {
                        // store ptr %t<N>, ptr %name
                        emitter.emit(LLVM_STORE_PTR, 0, LLVM_STORE_PTR.length);
                        emit_tmp_ref(val_t);
                        emitter.emit(LLVM_STORE_TO, 0, LLVM_STORE_TO.length);
                        const nlen = intern_length(name_off) | 0;
                        emitter.emit(intern_pool, name_off, nlen);
                        emitter.emit(LLVM_STORE_NL, 0, 1);
                    } else {
                        // store i32 %t<N>, ptr %name
                        emitter.emit(LLVM_STORE_I32, 0, LLVM_STORE_I32.length);
                        emit_tmp_ref(val_t);
                        emitter.emit(LLVM_STORE_TO, 0, LLVM_STORE_TO.length);
                        const nlen = intern_length(name_off) | 0;
                        emitter.emit(intern_pool, name_off, nlen);
                        emitter.emit(LLVM_STORE_NL, 0, 1);
                    }
                }
            }
            return -1;
        }

        // ── Identifier (0x03) — read path ──
        // Checks global_set first: module-level vars use 'load i32, ptr @name'
        // Parameters use direct register reference (no load needed)
        // Local allocas use 'load i32, ptr %name'
        if (base === NODE_IDENTIFIER) {
            const name_off = d1 | 0;
            // Check if this is a module-level global
            if (global_set[name_off]) {
                const t = next_tmp() | 0;
                emit_tmp_def(t);
                emitter.emit(Buffer.from(' = load i32, ptr @'), 0, 18);
                const nlen = intern_length(name_off) | 0;
                emitter.emit(intern_pool, name_off, nlen);
                emitter.emit(LLVM_NEWLINE, 0, 1);
                return t | 0;
            }
            const t = emit_load_i32(name_off) | 0;
            return t | 0;
        }

        // ── Literal (0x04) ──
        if (base === NODE_LITERAL) {
            if (tf & FLAG_NUMBER) {
                // Emit a constant directly — in LLVM IR, constants are used inline.
                // We store to a temp alloca so the caller gets a temp register.
                const val = d1 | 0;
                const t = next_tmp() | 0;
                emit_tmp_def(t);
                // Use 'add i32 0, <val>' as idiom for 'constant in register'
                emitter.emit(Buffer.from(' = add i32 0, '), 0, 14);
                const len = int_to_ascii(val) | 0;
                emitter.emit(num_scratch, 0, len);
                emitter.emit(LLVM_NEWLINE, 0, 1);
                return t | 0;
            }
            // Boolean, null, etc — emit 0 or 1
            const t = next_tmp() | 0;
            emit_tmp_def(t);
            if (tf & FLAG_BOOLEAN) {
                emitter.emit(Buffer.from(' = add i32 0, '), 0, 14);
                emitter.emit(Buffer.from(d1 !== 0 ? '1' : '0'), 0, 1);
            } else {
                emitter.emit(Buffer.from(' = add i32 0, 0'), 0, 15);
            }
            emitter.emit(LLVM_NEWLINE, 0, 1);
            return t | 0;
        }


        // ── BinaryExpression (0x0C) ──
        if (base === NODE_BINARY_EXPRESSION) {
            const op_token = (tf >>> 16) | 0;
            const lhs_t = walk(d1) | 0;
            const rhs_t = walk(d2) | 0;
            const t = next_tmp() | 0;

            // Determine if this is a comparison op (produces i1 → needs zext to i32)
            // NOTE: LOGICAL_AND/OR operate on already-i32 values, so excluded here.
            const is_cmp = (op_token === TOKEN_STRICT_EQ ||
                op_token === TOKEN_STRICT_NEQ ||
                op_token === TOKEN_LT ||
                op_token === TOKEN_GT ||
                op_token === TOKEN_LTE ||
                op_token === TOKEN_GTE);

            emit_tmp_def(t);

            if (op_token === TOKEN_PLUS) emitter.emit(LLVM_ADD, 0, LLVM_ADD.length);
            else if (op_token === TOKEN_MINUS) emitter.emit(LLVM_SUB, 0, LLVM_SUB.length);
            else if (op_token === TOKEN_MUL) emitter.emit(LLVM_MUL, 0, LLVM_MUL.length);
            else if (op_token === TOKEN_DIV) emitter.emit(LLVM_SDIV, 0, LLVM_SDIV.length);
            else if (op_token === TOKEN_MOD) emitter.emit(LLVM_SREM, 0, LLVM_SREM.length);
            else if (op_token === TOKEN_BIT_OR) emitter.emit(LLVM_OR, 0, LLVM_OR.length);
            else if (op_token === TOKEN_BIT_AND) emitter.emit(LLVM_AND, 0, LLVM_AND.length);
            else if (op_token === TOKEN_BIT_XOR) emitter.emit(LLVM_XOR, 0, LLVM_XOR.length);
            else if (op_token === TOKEN_LSHIFT) emitter.emit(LLVM_SHL, 0, LLVM_SHL.length);
            else if (op_token === TOKEN_RSHIFT) emitter.emit(LLVM_ASHR, 0, LLVM_ASHR.length);
            else if (op_token === TOKEN_URSHIFT) emitter.emit(LLVM_LSHR, 0, LLVM_LSHR.length);
            else if (op_token === TOKEN_STRICT_EQ) emitter.emit(LLVM_ICMP_EQ, 0, LLVM_ICMP_EQ.length);
            else if (op_token === TOKEN_STRICT_NEQ) emitter.emit(LLVM_ICMP_NE, 0, LLVM_ICMP_NE.length);
            else if (op_token === TOKEN_LT) emitter.emit(LLVM_ICMP_SLT, 0, LLVM_ICMP_SLT.length);
            else if (op_token === TOKEN_GT) emitter.emit(LLVM_ICMP_SGT, 0, LLVM_ICMP_SGT.length);
            else if (op_token === TOKEN_LTE) emitter.emit(LLVM_ICMP_SLE, 0, LLVM_ICMP_SLE.length);
            else if (op_token === TOKEN_GTE) emitter.emit(LLVM_ICMP_SGE, 0, LLVM_ICMP_SGE.length);
            else if (op_token === TOKEN_LOGICAL_AND) emitter.emit(LLVM_LOG_AND, 0, LLVM_LOG_AND.length);
            else if (op_token === TOKEN_LOGICAL_OR) emitter.emit(LLVM_LOG_OR, 0, LLVM_LOG_OR.length);
            else emitter.emit(LLVM_ADD, 0, LLVM_ADD.length); // fallback

            emit_tmp_ref(lhs_t);
            emitter.emit(LLVM_COMMA_SPACE, 0, 2);
            emit_tmp_ref(rhs_t);
            emitter.emit(LLVM_NEWLINE, 0, 1);

            // If comparison produced i1, immediately zext to i32 so our unified
            // runtime memory model (all i32) stays consistent. Control flow
            // nodes (if/while/for) will truncate back to i1 before br.
            if (is_cmp) {
                const wide_t = next_tmp() | 0;
                emit_tmp_def(wide_t);
                emitter.emit(LLVM_ZEXT_I1_I32, 0, LLVM_ZEXT_I1_I32.length);
                const len_t = int_to_ascii(t) | 0;
                emitter.emit(num_scratch, 0, len_t);
                emitter.emit(LLVM_ZEXT_SFX, 0, LLVM_ZEXT_SFX.length);
                return wide_t | 0;
            }

            return t | 0;
        }

        // ── AssignmentExpression (0x15) ──
        if (base === NODE_ASSIGNMENT_EXPRESSION) {
            // d1 = LHS identifier/member, d2 packed with op in upper bits
            // For simple identifier assignment: LHS is an Identifier node
            const op_token = (tf >>> 16) | 0;
            const lhs_idx = d1 | 0;
            const rhs_idx = d2 | 0;

            const lhs_tf = ast_nodes[lhs_idx] | 0;
            const lhs_base = lhs_tf & 0xFF;

            // ── Intercept: module.exports = X ──
            // CommonJS exports are a runtime concept — in a native LLVM binary,
            // the lazy getter already handles exports. Skip this entirely.
            if (lhs_base === NODE_MEMBER_EXPRESSION) {
                const obj_idx = ast_nodes[(lhs_idx + 2) | 0] | 0;
                const prop_idx = ast_nodes[(lhs_idx + 3) | 0] | 0;
                const obj_tf = ast_nodes[obj_idx] | 0;
                const obj_base = obj_tf & 0xFF;
                if (obj_base === NODE_IDENTIFIER) {
                    const obj_off = ast_nodes[(obj_idx + 2) | 0] | 0;
                    const obj_len = intern_length(obj_off) | 0;
                    // 'module' = 6 bytes: m=109 o=111 d=100 u=117 l=108 e=101
                    if (obj_len === 6 &&
                        intern_pool[obj_off] === 109 && // m
                        intern_pool[(obj_off + 1) | 0] === 111 && // o
                        intern_pool[(obj_off + 2) | 0] === 100 && // d
                        intern_pool[(obj_off + 3) | 0] === 117 && // u
                        intern_pool[(obj_off + 4) | 0] === 108 && // l
                        intern_pool[(obj_off + 5) | 0] === 101) { // e
                        // This is module.exports = X — skip the entire statement
                        emitter.emit(Buffer.from('  ; (module.exports skipped — handled by lazy getter)\n'), 0, 52);
                        return -1;
                    }
                }
            }

            const rhs_t = walk(rhs_idx) | 0;

            if (lhs_base === NODE_IDENTIFIER) {
                const name_off = ast_nodes[(lhs_idx + 2) | 0] | 0;
                if (global_set[name_off]) {
                    // Module-level global: store i32 %t<rhs>, ptr @name
                    emitter.emit(Buffer.from('  store i32 '), 0, 12);
                    emit_tmp_ref(rhs_t);
                    emitter.emit(Buffer.from(', ptr @'), 0, 7);
                    const nlen = intern_length(name_off) | 0;
                    emitter.emit(intern_pool, name_off, nlen);
                    emitter.emit(LLVM_STORE_NL, 0, 1);
                } else {
                    // Local alloca: store i32 %t<rhs>, ptr %name
                    emitter.emit(LLVM_STORE_I32, 0, LLVM_STORE_I32.length);
                    emit_tmp_ref(rhs_t);
                    emitter.emit(LLVM_STORE_TO, 0, LLVM_STORE_TO.length);
                    const nlen = intern_length(name_off) | 0;
                    emitter.emit(intern_pool, name_off, nlen);
                    emitter.emit(LLVM_STORE_NL, 0, 1);
                }
            } else if (lhs_base === NODE_MEMBER_EXPRESSION) {
                // Computed member assignment: result[i] = val
                // LHS: d1=object, d2=index
                const obj_idx = ast_nodes[(lhs_idx + 2) | 0] | 0;
                const idx_idx = ast_nodes[(lhs_idx + 3) | 0] | 0;
                const lhs_is_float = (lhs_tf & FLAG_FLOAT) !== 0;

                // Load the object pointer — always needs ptr type for GEP
                const obj_tf = ast_nodes[obj_idx] | 0;
                const obj_base = obj_tf & 0xFF;
                let ptr_t = -1;
                if (obj_base === NODE_IDENTIFIER) {
                    const obj_name_off = ast_nodes[(obj_idx + 2) | 0] | 0;
                    ptr_t = emit_load_as_ptr(obj_name_off) | 0;
                }

                // Evaluate index
                const idx_t = walk(idx_idx) | 0;

                // GEP: get element pointer
                const gep_t = next_tmp() | 0;
                emit_tmp_def(gep_t);
                if (lhs_is_float) {
                    emitter.emit(LLVM_GEP_F32_PFX, 0, LLVM_GEP_F32_PFX.length);
                } else {
                    emitter.emit(LLVM_GEP_I32_PFX, 0, LLVM_GEP_I32_PFX.length);
                }
                const len1 = int_to_ascii(ptr_t) | 0;
                emitter.emit(num_scratch, 0, len1);
                emitter.emit(LLVM_GEP_IDX, 0, LLVM_GEP_IDX.length);
                const len2 = int_to_ascii(idx_t) | 0;
                emitter.emit(num_scratch, 0, len2);
                emitter.emit(LLVM_GEP_NL, 0, 1);

                // Store
                if (lhs_is_float) {
                    // The RHS is an i32 bit pattern from buffer — bitcast to float
                    const bc_t = next_tmp() | 0;
                    emit_tmp_def(bc_t);
                    emitter.emit(LLVM_BITCAST_I2F, 0, LLVM_BITCAST_I2F.length);
                    const lenbc = int_to_ascii(rhs_t) | 0;
                    emitter.emit(num_scratch, 0, lenbc);
                    emitter.emit(LLVM_BITCAST_SFX, 0, LLVM_BITCAST_SFX.length);
                    // store float %t<bc>, float* %t<gep>
                    emitter.emit(LLVM_STORE_F32_TO, 0, LLVM_STORE_F32_TO.length);
                    emit_tmp_ref(bc_t);
                    emitter.emit(LLVM_STORE_F32_PTR, 0, LLVM_STORE_F32_PTR.length);
                    const leng = int_to_ascii(gep_t) | 0;
                    emitter.emit(num_scratch, 0, leng);
                    emitter.emit(LLVM_STORE_NL, 0, 1);
                } else {
                    // store i32 %t<rhs>, ptr %t<gep>
                    emitter.emit(LLVM_STORE_I32, 0, LLVM_STORE_I32.length);
                    emit_tmp_ref(rhs_t);
                    emitter.emit(LLVM_STORE_TO_T, 0, LLVM_STORE_TO_T.length);
                    const leng = int_to_ascii(gep_t) | 0;
                    emitter.emit(num_scratch, 0, leng);
                    emitter.emit(LLVM_STORE_NL, 0, 1);
                }
            }
            return rhs_t | 0;
        }

        // ── UpdateExpression (0x16) — ++ and -- ──
        if (base === NODE_UPDATE_EXPRESSION) {
            const op_token = (tf >>> 8) & 0xFF;
            const arg_idx = d1 | 0;
            const arg_tf = ast_nodes[arg_idx] | 0;
            const arg_name_off = ast_nodes[(arg_idx + 2) | 0] | 0;

            // Load current value
            const cur_t = emit_load_i32(arg_name_off) | 0;

            // Add or subtract 1
            const new_t = next_tmp() | 0;
            emit_tmp_def(new_t);
            if ((op_token | 0) === (TOKEN_INCREMENT | 0)) {
                emitter.emit(LLVM_ADD, 0, LLVM_ADD.length);
            } else {
                emitter.emit(LLVM_SUB, 0, LLVM_SUB.length);
            }
            emit_tmp_ref(cur_t);
            emitter.emit(LLVM_COMMA_SPACE, 0, 2);
            emitter.emit(Buffer.from('1'), 0, 1);
            emitter.emit(LLVM_NEWLINE, 0, 1);

            // Store back (check if global)
            if (global_set[arg_name_off]) {
                emitter.emit(Buffer.from('  store i32 '), 0, 12);
                emit_tmp_ref(new_t);
                emitter.emit(Buffer.from(', ptr @'), 0, 7);
                const nlen = intern_length(arg_name_off) | 0;
                emitter.emit(intern_pool, arg_name_off, nlen);
                emitter.emit(LLVM_STORE_NL, 0, 1);
            } else {
                emitter.emit(LLVM_STORE_I32, 0, LLVM_STORE_I32.length);
                emit_tmp_ref(new_t);
                emitter.emit(LLVM_STORE_TO, 0, LLVM_STORE_TO.length);
                const nlen = intern_length(arg_name_off) | 0;
                emitter.emit(intern_pool, arg_name_off, nlen);
                emitter.emit(LLVM_STORE_NL, 0, 1);
            }

            // Return new value (post-increment semantics for LLVM backend)
            return new_t | 0;
        }

        // ── ReturnStatement (0x0B) ──
        if (base === NODE_RETURN_STATEMENT) {
            if (d1 < 0) {
                emitter.emit(LLVM_RET_VOID, 0, LLVM_RET_VOID.length);
                return -1;
            }
            const ret_tf = ast_nodes[d1] | 0;
            const ret_base = ret_tf & 0xFF;
            const ret_float = (ret_tf & FLAG_FLOAT) !== 0;

            if (ret_float || ret_base === NODE_NEW_EXPRESSION) {
                // Return ptr from identifier (load the pointer then ret)
                const ret_name_off = ast_nodes[(d1 + 2) | 0] | 0;
                const t = emit_load_ptr(ret_name_off) | 0;
                emitter.emit(LLVM_RET_PTR, 0, LLVM_RET_PTR.length);
                const len = int_to_ascii(t) | 0;
                emitter.emit(num_scratch, 0, len);
                emitter.emit(LLVM_RET_NL, 0, 1);
            } else {
                const val_t = walk(d1) | 0;
                emitter.emit(LLVM_RET_I32, 0, LLVM_RET_I32.length);
                emit_tmp_ref(val_t);
                emitter.emit(LLVM_RET_NL, 0, 1);
            }
            return -1;
        }

        // ── WhileStatement (0x0A) ──
        if (base === NODE_WHILE_STATEMENT) {
            const cond_idx = d1 | 0;
            const body_idx = d2 | 0;

            const blk = next_block() | 0;
            const LOOP_LABEL = Buffer.from('loop.');
            const BODY_LABEL = Buffer.from('body.');
            const EXIT_LABEL = Buffer.from('exit.');

            // Jump to loop header
            emitter.emit(LLVM_BR, 0, LLVM_BR.length);
            emit_label(LOOP_LABEL, blk);
            emitter.emit(LLVM_BR_NL, 0, 1);

            // loop.<N>: evaluate condition
            emit_label(LOOP_LABEL, blk);
            emitter.emit(LLVM_LABEL_COLON, 0, 2);
            const cond_i32_w = walk(cond_idx) | 0;

            // Truncate i32 → i1 for br (condition came from zext-ed comparison)
            const cond_t_w = next_tmp() | 0;
            emit_tmp_def(cond_t_w);
            emitter.emit(LLVM_TRUNC_I32_I1, 0, LLVM_TRUNC_I32_I1.length);
            const len_ci32 = int_to_ascii(cond_i32_w) | 0;
            emitter.emit(num_scratch, 0, len_ci32);
            emitter.emit(LLVM_TRUNC_ZERO, 0, LLVM_TRUNC_ZERO.length);

            // Conditional branch
            emitter.emit(LLVM_BR_COND_PFX, 0, LLVM_BR_COND_PFX.length);
            const len_c = int_to_ascii(cond_t_w) | 0;
            emitter.emit(num_scratch, 0, len_c);
            emitter.emit(LLVM_BR_COND_TRUE, 0, LLVM_BR_COND_TRUE.length);
            emit_label(BODY_LABEL, blk);
            emitter.emit(LLVM_BR_COND_FALSE, 0, LLVM_BR_COND_FALSE.length);
            emit_label(EXIT_LABEL, blk);
            emitter.emit(LLVM_BR_NL, 0, 1);

            // body.<N>:
            emit_label(BODY_LABEL, blk);
            emitter.emit(LLVM_LABEL_COLON, 0, 2);
            walk(body_idx);
            emitter.emit(LLVM_BR, 0, LLVM_BR.length);
            emit_label(LOOP_LABEL, blk);
            emitter.emit(LLVM_BR_NL, 0, 1);

            // exit.<N>:
            emit_label(EXIT_LABEL, blk);
            emitter.emit(LLVM_LABEL_COLON, 0, 2);

            return -1;
        }

        // ── ForStatement (0x14) ──
        if (base === NODE_FOR_STATEMENT) {
            // Parser layout: d1=extra_start [init_idx, test_idx, update_idx], d2=body_idx
            const extra_start = d1 | 0;
            const init_idx = ast_extra[extra_start] | 0;
            const test_idx = ast_extra[(extra_start + 1) | 0] | 0;
            const update_idx = ast_extra[(extra_start + 2) | 0] | 0;
            const body_idx = d2 | 0;

            const blk = next_block() | 0;
            const LOOP_LABEL = Buffer.from('for.');
            const BODY_LABEL = Buffer.from('forbody.');
            const UPDATE_LABEL = Buffer.from('forupdate.');
            const EXIT_LABEL = Buffer.from('forexit.');

            // Emit init
            if (init_idx >= 0) walk(init_idx);

            // Jump to loop header
            emitter.emit(LLVM_BR, 0, LLVM_BR.length);
            emit_label(LOOP_LABEL, blk);
            emitter.emit(LLVM_BR_NL, 0, 1);

            // for.<N>: evaluate test
            emit_label(LOOP_LABEL, blk);
            emitter.emit(LLVM_LABEL_COLON, 0, 2);
            let cond_t = -1;
            if (test_idx >= 0) {
                const cond_i32_f = walk(test_idx) | 0;
                // Truncate i32 → i1 for br
                cond_t = next_tmp() | 0;
                emit_tmp_def(cond_t);
                emitter.emit(LLVM_TRUNC_I32_I1, 0, LLVM_TRUNC_I32_I1.length);
                const len_cf = int_to_ascii(cond_i32_f) | 0;
                emitter.emit(num_scratch, 0, len_cf);
                emitter.emit(LLVM_TRUNC_ZERO, 0, LLVM_TRUNC_ZERO.length);

                emitter.emit(LLVM_BR_COND_PFX, 0, LLVM_BR_COND_PFX.length);
                const len_c = int_to_ascii(cond_t) | 0;
                emitter.emit(num_scratch, 0, len_c);
                emitter.emit(LLVM_BR_COND_TRUE, 0, LLVM_BR_COND_TRUE.length);
                emit_label(BODY_LABEL, blk);
                emitter.emit(LLVM_BR_COND_FALSE, 0, LLVM_BR_COND_FALSE.length);
                emit_label(EXIT_LABEL, blk);
                emitter.emit(LLVM_BR_NL, 0, 1);
            } else {
                emitter.emit(LLVM_BR, 0, LLVM_BR.length);
                emit_label(BODY_LABEL, blk);
                emitter.emit(LLVM_BR_NL, 0, 1);
            }

            // forbody.<N>:
            emit_label(BODY_LABEL, blk);
            emitter.emit(LLVM_LABEL_COLON, 0, 2);
            walk(body_idx);
            emitter.emit(LLVM_BR, 0, LLVM_BR.length);
            emit_label(UPDATE_LABEL, blk);
            emitter.emit(LLVM_BR_NL, 0, 1);

            // forupdate.<N>:
            emit_label(UPDATE_LABEL, blk);
            emitter.emit(LLVM_LABEL_COLON, 0, 2);
            if (update_idx >= 0) walk(update_idx);
            emitter.emit(LLVM_BR, 0, LLVM_BR.length);
            emit_label(LOOP_LABEL, blk);
            emitter.emit(LLVM_BR_NL, 0, 1);

            // forexit.<N>:
            emit_label(EXIT_LABEL, blk);
            emitter.emit(LLVM_LABEL_COLON, 0, 2);

            return -1;
        }

        // ── IfStatement (0x09) ──
        if (base === NODE_IF_STATEMENT) {
            const cond_idx = d1 | 0;
            const extra_start = d2 | 0;
            const consequent = ast_extra[extra_start] | 0;
            const alternate = ast_extra[(extra_start + 1) | 0] | 0;

            const blk = next_block() | 0;
            const THEN_LABEL = Buffer.from('then.');
            const ELSE_LABEL = Buffer.from('else.');
            const MERGE_LABEL = Buffer.from('merge.');

            const cond_i32_if = walk(cond_idx) | 0;
            // Truncate i32 → i1 for br
            const cond_t = next_tmp() | 0;
            emit_tmp_def(cond_t);
            emitter.emit(LLVM_TRUNC_I32_I1, 0, LLVM_TRUNC_I32_I1.length);
            const len_ci = int_to_ascii(cond_i32_if) | 0;
            emitter.emit(num_scratch, 0, len_ci);
            emitter.emit(LLVM_TRUNC_ZERO, 0, LLVM_TRUNC_ZERO.length);

            emitter.emit(LLVM_BR_COND_PFX, 0, LLVM_BR_COND_PFX.length);
            const len_c = int_to_ascii(cond_t) | 0;
            emitter.emit(num_scratch, 0, len_c);
            emitter.emit(LLVM_BR_COND_TRUE, 0, LLVM_BR_COND_TRUE.length);
            emit_label(THEN_LABEL, blk);
            emitter.emit(LLVM_BR_COND_FALSE, 0, LLVM_BR_COND_FALSE.length);
            if (alternate >= 0) {
                emit_label(ELSE_LABEL, blk);
            } else {
                emit_label(MERGE_LABEL, blk);
            }
            emitter.emit(LLVM_BR_NL, 0, 1);

            // then.<N>:
            emit_label(THEN_LABEL, blk);
            emitter.emit(LLVM_LABEL_COLON, 0, 2);
            walk(consequent);
            emitter.emit(LLVM_BR, 0, LLVM_BR.length);
            emit_label(MERGE_LABEL, blk);
            emitter.emit(LLVM_BR_NL, 0, 1);

            if (alternate >= 0) {
                emit_label(ELSE_LABEL, blk);
                emitter.emit(LLVM_LABEL_COLON, 0, 2);
                walk(alternate);
                emitter.emit(LLVM_BR, 0, LLVM_BR.length);
                emit_label(MERGE_LABEL, blk);
                emitter.emit(LLVM_BR_NL, 0, 1);
            }

            // merge.<N>:
            emit_label(MERGE_LABEL, blk);
            emitter.emit(LLVM_LABEL_COLON, 0, 2);
            return -1;
        }

        // ── NewExpression (0x10) — Float32Array ──
        if (base === NODE_NEW_EXPRESSION) {
            if (is_float) {
                // new Float32Array(count) → call float* @ohn_alloc_f32(i32 %t<count>)
                // d2 = extra_start: [arg_count, ...args]
                const extra_start = d2 | 0;
                const arg_count = ast_extra[extra_start] | 0;
                let size_t = -1;
                if (arg_count > 0) {
                    size_t = walk(ast_extra[(extra_start + 1) | 0] | 0) | 0;
                }
                const t = next_tmp() | 0;
                emit_tmp_def(t);
                emitter.emit(LLVM_CALL_PTR, 0, LLVM_CALL_PTR.length);
                const len = int_to_ascii(size_t) | 0;
                emitter.emit(num_scratch, 0, len);
                emitter.emit(LLVM_CALL_RPAREN, 0, 2);
                return t | 0;
            }
            // Generic new expression — unsupported in first pass
            emitter.emit(LLVM_UNSUPPORTED, 0, LLVM_UNSUPPORTED.length);
            const len = int_to_hex(base) | 0;
            emitter.emit(hex_scratch, 0, len);
            emitter.emit(LLVM_NEWLINE, 0, 1);
            const ne_dummy = next_tmp() | 0;
            emit_tmp_def(ne_dummy);
            emitter.emit(Buffer.from(' = add i32 0, 0\n'), 0, 16);
            return ne_dummy | 0;
        }

        // ── MemberExpression computed (0x07 | FLAG_COMPUTED) — array read ──
        if (base === NODE_MEMBER_EXPRESSION) {
            if (tf & FLAG_COMPUTED) {
                // obj[idx] → GEP + load
                const obj_idx = d1 | 0;
                const idx_idx = d2 | 0;

                const obj_tf = ast_nodes[obj_idx] | 0;
                const obj_base = obj_tf & 0xFF;

                let ptr_t = -1;
                if (obj_base === NODE_IDENTIFIER) {
                    const obj_name_off = ast_nodes[(obj_idx + 2) | 0] | 0;
                    // Always load as ptr — GEP base must be ptr type
                    ptr_t = emit_load_as_ptr(obj_name_off) | 0;
                } else {
                    ptr_t = walk(obj_idx) | 0;
                }

                const idx_t = walk(idx_idx) | 0;

                // GEP
                const gep_t = next_tmp() | 0;
                emit_tmp_def(gep_t);
                if (is_float) {
                    emitter.emit(LLVM_GEP_F32_PFX, 0, LLVM_GEP_F32_PFX.length);
                } else {
                    emitter.emit(LLVM_GEP_I32_PFX, 0, LLVM_GEP_I32_PFX.length);
                }
                const len1 = int_to_ascii(ptr_t) | 0;
                emitter.emit(num_scratch, 0, len1);
                emitter.emit(LLVM_GEP_IDX, 0, LLVM_GEP_IDX.length);
                const len2 = int_to_ascii(idx_t) | 0;
                emitter.emit(num_scratch, 0, len2);
                emitter.emit(LLVM_GEP_NL, 0, 1);

                // Load element
                const load_t = next_tmp() | 0;
                emit_tmp_def(load_t);
                if (is_float) {
                    emitter.emit(LLVM_LOAD_PTR_F32, 0, LLVM_LOAD_PTR_F32.length);
                } else {
                    emitter.emit(LLVM_LOAD_PTR_I32, 0, LLVM_LOAD_PTR_I32.length);
                }
                const len3 = int_to_ascii(gep_t) | 0;
                emitter.emit(num_scratch, 0, len3);
                emitter.emit(LLVM_NEWLINE, 0, 1);

                return load_t | 0;
            }

            // Non-computed member expression — unsupported in first pass
            emitter.emit(LLVM_UNSUPPORTED, 0, LLVM_UNSUPPORTED.length);
            const len = int_to_hex(base) | 0;
            emitter.emit(hex_scratch, 0, len);
            emitter.emit(Buffer.from(' (non-computed member)'), 0, 22);
            emitter.emit(LLVM_NEWLINE, 0, 1);
            const mem_dummy = next_tmp() | 0;
            emit_tmp_def(mem_dummy);
            emitter.emit(Buffer.from(' = add i32 0, 0\n'), 0, 16);
            return mem_dummy | 0;
        }

        // ── CallExpression (0x05) ──
        // Intercept require('module') calls and translate to lazy getter.
        // All other calls emit unsupported for now.
        if (base === NODE_CALL_EXPRESSION) {
            // d1 = callee idx, d2 = extra_start: [arg_count, ...args]
            const callee_idx = d1 | 0;
            const extra_start = d2 | 0;
            const callee_tf = ast_nodes[callee_idx] | 0;
            const callee_base = callee_tf & 0xFF;

            // Check if callee is an Identifier named 'require'
            if (callee_base === NODE_IDENTIFIER) {
                const callee_off = ast_nodes[(callee_idx + 2) | 0] | 0;
                const callee_len = intern_length(callee_off) | 0;
                // 'require' is 7 bytes: r=114 e=101 q=113 u=117 i=105 r=114 e=101
                if (callee_len === 7 &&
                    intern_pool[callee_off] === 114 &&  // r
                    intern_pool[(callee_off + 1) | 0] === 101 && // e
                    intern_pool[(callee_off + 2) | 0] === 113 && // q
                    intern_pool[(callee_off + 3) | 0] === 117 && // u
                    intern_pool[(callee_off + 4) | 0] === 105 && // i
                    intern_pool[(callee_off + 5) | 0] === 114 && // r
                    intern_pool[(callee_off + 6) | 0] === 101) { // e
                    // This is require('module_name')
                    // Get the module name string from the first argument
                    const arg_count = ast_extra[extra_start] | 0;
                    if (arg_count >= 1) {
                        const arg_idx = ast_extra[(extra_start + 1) | 0] | 0;
                        const arg_tf = ast_nodes[arg_idx] | 0;
                        const arg_base = arg_tf & 0xFF;
                        if (arg_base === NODE_LITERAL && (arg_tf & FLAG_STRING) !== 0) {
                            // d1 of Literal string = intern offset of the string value
                            const str_off = ast_nodes[(arg_idx + 2) | 0] | 0;
                            const str_len = intern_length(str_off) | 0;
                            // Sanitize module name: replace non-alphanumeric with _
                            let mod_buf = '';
                            for (let si = 0; si < str_len; si = (si + 1) | 0) {
                                const ch = intern_pool[(str_off + si) | 0];
                                if ((ch >= 65 && ch <= 90) ||   // A-Z
                                    (ch >= 97 && ch <= 122) ||  // a-z
                                    (ch >= 48 && ch <= 57)) {   // 0-9
                                    mod_buf += String.fromCharCode(ch);
                                } else {
                                    mod_buf += '_';
                                }
                            }
                            // Emit: %t<N> = call ptr @__get_module_exports_<mod>()
                            const t = next_tmp() | 0;
                            emit_tmp_def(t);
                            emitter.emit(LLVM_CALL_GET_PFX, 0, LLVM_CALL_GET_PFX.length);
                            const mod_b = Buffer.from(mod_buf);
                            emitter.emit(mod_b, 0, mod_b.length);
                            emitter.emit(Buffer.from('()\n'), 0, 3);
                            return t | 0;
                        }
                    }
                }
            }

            // Unknown call — emit unsupported, return safe dummy
            emitter.emit(LLVM_UNSUPPORTED, 0, LLVM_UNSUPPORTED.length);
            const len = int_to_hex(base) | 0;
            emitter.emit(hex_scratch, 0, len);
            emitter.emit(Buffer.from(' (call expression)'), 0, 18);
            emitter.emit(LLVM_NEWLINE, 0, 1);
            const call_dummy = next_tmp() | 0;
            emit_tmp_def(call_dummy);
            emitter.emit(Buffer.from(' = add i32 0, 0\n'), 0, 16);
            return call_dummy | 0;
        }

        // ── All other nodes: emit UNSUPPORTED comment and return a SAFE DUMMY register ──
        // We emit 'add i32 0, 0' as a no-op that returns a valid i32 register.
        // This prevents cascading failures where a caller tries to use register %t-1.
        emitter.emit(LLVM_UNSUPPORTED, 0, LLVM_UNSUPPORTED.length);
        const hex_len = int_to_hex(base) | 0;
        emitter.emit(hex_scratch, 0, hex_len);
        emitter.emit(LLVM_NEWLINE, 0, 1);
        const dummy_t = next_tmp() | 0;
        emit_tmp_def(dummy_t);
        emitter.emit(Buffer.from(' = add i32 0, 0\n'), 0, 16);
        return dummy_t | 0;
    }

    // ============================================================
    // Start walking from root
    // ============================================================
    walk(root_index | 0);

    // Flush remaining bytes to disk
    emitter.flush();
}

module.exports = { generate };
```

## File: packages-llvm/ohn-kernel/src/kernel.ohn

```javascript
// kernel.ohn
// Ohnrscript Kernel v0.1
//
// The first kernel compiled from JavaScript syntax to native machine code
// via LLVM IR — no JavaScript runtime, no GC, no engine.
//
// Compiled: .ohn → Ohnrscript LLVM generator → kernel.ll → clang -O2 → ELF binary
// Boots:    GRUB multiboot2 → boot.c entry → kernelMain()
// Runs:     x86-64 ring 0, bare metal (tested in QEMU)
//
// DESIGN: kernelMain is self-contained — all logic is inlined.
// The Ohnrscript LLVM generator first-pass does not support user-defined
// function calls (only external require() calls). Each function here is
// independently callable from the boot.c shim, and kernelMain inlines
// its own VGA writes directly.
//
// This is documented honestly: the generator's first-pass limitation means
// all kernel logic must live in a single function body. This is equivalent
// to writing a kernel in a single C function — valid but verbose.
//
// CONSTRAINT: All constructs are in the proved LLVM generator subset.
// grep '; UNSUPPORTED' on kernel.ll returns zero results.

'use strict';

// ── Exported helper functions (compiled and available as native symbols) ──
// These compile cleanly and are callable from C (boot.c) if needed.

// vgaClear: fill the entire 80x25 VGA buffer with black spaces
function vgaClear(vga) {
    let i = 0;
    while (i < 4000) {
        vga[i]             = 32;
        vga[(i + 1) | 0]   = 0;
        i = (i + 2) | 0;
    }
}

// memoryScan: scan a memory region and return a checksum
function memoryScan(base, length) {
    let checksum = 0;
    let i = 0;
    while (i < length) {
        checksum = (checksum + (base[i] | 0)) | 0;
        i = (i + 1) | 0;
    }
    return checksum | 0;
}

// ── kernelMain: self-contained kernel entry point ─────────────────────────
// vga:  i64 address of VGA text buffer (0xB8000)
// msg1..msg5: i64 addresses of string byte arrays from boot.c
// len1..len5: i32 lengths of each string
//
// VGA layout: cell = 2 bytes [charByte, colorByte]
//   Index in buffer = (row * 80 + col) * 2
//   Color 0x0F = bright white on black
//   Color 0x0A = bright green on black
//   Color 0x0E = bright yellow on black
//   Color 0x08 = dark gray on black

function kernelMain(vga, msg1, len1, msg2, len2, msg3, len3, msg4, len4, msg5, len5) {

    // ── Step 1: Clear screen (inline vgaClear) ──────────────────────────
    let ci = 0;
    while (ci < 4000) {
        vga[ci]             = 32;
        vga[(ci + 1) | 0]   = 0;
        ci = (ci + 2) | 0;
    }

    // ── Step 2: Write banner row 0 (white, color=15) ────────────────────
    let i0 = 0;
    while (i0 < len1) {
        const c0   = msg1[i0] | 0;
        const off0 = (i0 * 2) | 0;
        vga[off0]           = c0;
        vga[(off0 + 1) | 0] = 15;
        i0 = (i0 + 1) | 0;
    }

    // ── Step 3: Write separator row 1 (dark gray, color=8) ──────────────
    let i1 = 0;
    while (i1 < len2) {
        const c1   = msg2[i1] | 0;
        const off1 = ((80 + i1) * 2) | 0;
        vga[off1]           = c1;
        vga[(off1 + 1) | 0] = 8;
        i1 = (i1 + 1) | 0;
    }

    // ── Step 4: Write OK status row 3 (bright green, color=10) ─────────
    let i2 = 0;
    while (i2 < len3) {
        const c2   = msg3[i2] | 0;
        const off2 = (((80 * 3) + i2) * 2) | 0;
        vga[off2]           = c2;
        vga[(off2 + 1) | 0] = 10;
        i2 = (i2 + 1) | 0;
    }

    // ── Step 5: Write scan label row 5 (bright yellow, color=14) ────────
    let i3 = 0;
    while (i3 < len4) {
        const c3   = msg4[i3] | 0;
        const off3 = (((80 * 5) + i3) * 2) | 0;
        vga[off3]           = c3;
        vga[(off3 + 1) | 0] = 14;
        i3 = (i3 + 1) | 0;
    }

    // ── Step 6: Memory scan checksum (inline memoryScan on VGA buffer) ──
    let checksum = 0;
    let si = 0;
    while (si < 4000) {
        checksum = (checksum + (vga[si] | 0)) | 0;
        si = (si + 1) | 0;
    }

    // ── Step 7: Write checksum as 8 hex digits after label on row 5 ─────
    // col = len4 + 2, row = 5
    let hexVal = checksum | 0;
    let hi = 7;
    while (hi >= 0) {
        const nibble = hexVal & 15;
        let hexCh = 0;
        if (nibble < 10) {
            hexCh = (48 + nibble) | 0;
        } else {
            hexCh = (55 + nibble) | 0;
        }
        const hexCol  = ((len4 + 2 + hi) | 0);
        const hexOff  = (((80 * 5) + hexCol) * 2) | 0;
        vga[hexOff]           = hexCh;
        vga[(hexOff + 1) | 0] = 10;
        hexVal = (hexVal >> 4) | 0;
        hi = (hi - 1) | 0;
    }

    // ── Step 8: Write halt message row 7 (gray, color=7) ────────────────
    let i4 = 0;
    while (i4 < len5) {
        const c4   = msg5[i4] | 0;
        const off4 = (((80 * 7) + i4) * 2) | 0;
        vga[off4]           = c4;
        vga[(off4 + 1) | 0] = 7;
        i4 = (i4 + 1) | 0;
    }

    return 0;
}
```

