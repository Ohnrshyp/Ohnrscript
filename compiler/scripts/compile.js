#!/usr/bin/env node
// compiler/scripts/compile.js
// Ohnrscript Compiler CLI
// Compiles a .ohn source file to JavaScript (--target js) or LLVM IR (--target llvm).
//
// Usage:
//   node compiler/scripts/compile.js [--target js|llvm] <input.ohn> [-o <output>]
//
// Examples:
//   node compiler/scripts/compile.js packages/ohn-vector/src/ohn-vector.ohn
//   node compiler/scripts/compile.js --target llvm packages/ohn-vector/src/ohn-vector.ohn -o ohn-vector.ll
//   node compiler/scripts/compile.js --target js compiler/src/codegen/generator-llvm.ohn

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// Parse CLI arguments
// ============================================================
const args = process.argv.slice(2);

let target   = 'js';      // default target
let inputFile = null;
let outputFile = null;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target') {
        target = args[++i];
        if (target !== 'js' && target !== 'llvm') {
            console.error('Error: --target must be "js" or "llvm"');
            process.exit(1);
        }
    } else if (arg === '-o') {
        outputFile = args[++i];
    } else if (!arg.startsWith('-')) {
        inputFile = arg;
    }
}

if (!inputFile) {
    console.error('Usage: node compile.js [--target js|llvm] <input.ohn> [-o <output>]');
    process.exit(1);
}

if (!fs.existsSync(inputFile)) {
    console.error('Error: Input file not found: ' + inputFile);
    process.exit(1);
}

// ============================================================
// Check LLVM prerequisites if --target llvm
// ============================================================
if (target === 'llvm') {
    try {
        execSync('llc --version', { stdio: 'ignore' });
    } catch (e) {
        console.error('Error: llc (LLVM) not found on PATH.');
        console.error('Install with: brew install llvm');
        console.error('Then add to PATH: export PATH="$(brew --prefix llvm)/bin:$PATH"');
        process.exit(1);
    }
}

// ============================================================
// Resolve paths
// ============================================================
const ROOT         = path.resolve(__dirname, '../..');
const STAGE2_DIR   = path.resolve(ROOT, '.bootstrap/stage2');
const COMPILER_SRC = path.resolve(__dirname, '../src');

// Determine output file name
if (!outputFile) {
    const base = path.basename(inputFile, '.ohn');
    if (target === 'llvm') {
        outputFile = base + '.ll';
    } else {
        outputFile = base + '.js';
    }
}

// ============================================================
// Load the self-hosted compiler front-end (from .bootstrap/stage2)
// Falls back to source .ohn files via Node.js if stage2 not present
// ============================================================
let parser;
let generator;

function tryLoadSelfHosted() {
    const parserPath    = path.join(STAGE2_DIR, 'frontend/parser.js');
    const generatorJsPath = path.join(STAGE2_DIR, 'codegen/generator.js');

    if (!fs.existsSync(parserPath)) {
        return false;
    }

    parser = require(parserPath);

    if (target === 'llvm') {
        // The LLVM generator is always loaded from source (it's new)
        generator = require(path.join(COMPILER_SRC, 'codegen/generator-llvm.ohn'));
    } else {
        generator = require(generatorJsPath);
    }

    return true;
}

function tryLoadFromSource() {
    // Load directly from .ohn source files (Node.js can require them as-is)
    parser = require(path.join(COMPILER_SRC, 'frontend/parser.ohn'));

    if (target === 'llvm') {
        generator = require(path.join(COMPILER_SRC, 'codegen/generator-llvm.ohn'));
    } else {
        generator = require(path.join(COMPILER_SRC, 'codegen/generator.ohn'));
    }

    return true;
}

const loaded = tryLoadSelfHosted() || tryLoadFromSource();

if (!loaded) {
    console.error('Error: Could not load Ohnrscript compiler.');
    console.error('Run the bootstrap first: node compiler/scripts/bootstrap.js');
    process.exit(1);
}

// ============================================================
// Compile
// ============================================================
console.log('Ohnrscript Compiler');
console.log('  Input:  ' + inputFile);
console.log('  Output: ' + outputFile);
console.log('  Target: ' + target.toUpperCase());
console.log('');

const startMs = Date.now();

// Read source
const raw          = fs.readFileSync(inputFile);
const sourceBuffer = new Uint8Array(raw);

// Parse
const rootIndex = parser.parse(sourceBuffer);

// Generate
generator.generate(
    parser.get_ast_nodes(),
    parser.get_ast_extra(),
    parser.get_intern_pool(),
    rootIndex,
    outputFile
);

// Post-process: fix require paths from .ohn to .js (JS target only)
if (target === 'js') {
    const rawOutput   = fs.readFileSync(outputFile, 'utf-8');
    const fixedOutput = rawOutput.replace(/require\(['"]([^'"]*?)\.ohn['"]\)/g, "require('$1.js')");
    fs.writeFileSync(outputFile, fixedOutput);
}

const elapsedMs = Date.now() - startMs;

console.log('Compilation complete in ' + elapsedMs + 'ms');
console.log('Output: ' + outputFile);

if (target === 'llvm') {
    const stats = fs.statSync(outputFile);
    console.log('IR size: ' + stats.size + ' bytes');
    console.log('');
    console.log('To compile to a native binary:');
    const base = path.basename(outputFile, '.ll');
    const shimPath = path.join(COMPILER_SRC, 'shim/ohnrscript-runtime.c');
    console.log('  clang -O3 -march=native ' + outputFile + ' ' + shimPath + ' -o ' + base + ' -lm');
    console.log('');
    console.log('To verify IR syntax:');
    console.log('  llvm-as ' + outputFile + ' -o /dev/null');
}
