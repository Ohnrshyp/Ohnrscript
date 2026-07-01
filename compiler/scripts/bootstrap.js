#!/usr/bin/env node
// compiler/scripts/bootstrap.js
// The Tombstone Bootstrap Protocol for the Ohnrscript Self-Hosted Compiler
//
// Stage 0 (The Tombstone): Use the old Babel compiler to compile .ohn -> .js (stage1/)
// Stage 1 (Self-Hosting):  Use stage1/ to compile .ohn -> .js (stage2/)
// Stage 2 (Verification):  Use stage2/ to compile .ohn -> .js (stage3/)
// The Proof: stage2/ and stage3/ must be byte-for-byte identical.

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const COMPILER_SRC = path.resolve(__dirname, '../src');
const STAGE_DIR = path.resolve(ROOT, '.bootstrap');

// The compiler source files that must be compiled
const SOURCE_FILES = [
    'frontend/lexer.ohn',
    'frontend/parser.ohn',
    'core/arena.ohn',
    'codegen/emitter.ohn',
    'codegen/generator.ohn',
];

// ============================================================
// Utility functions
// ============================================================

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}

function hashFile(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

function hashDirectory(dir) {
    const hashes = {};
    const files = fs.readdirSync(dir, { recursive: true }).sort();
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isFile()) {
            hashes[file] = hashFile(fullPath);
        }
    }
    return hashes;
}

// ============================================================
// Stage 0: The Tombstone — compile .ohn with Babel
// ============================================================
function stage0(outputDir) {
    console.log('=== STAGE 0: The Tombstone (Babel Compilation) ===');
    cleanDir(outputDir);

    for (const rel of SOURCE_FILES) {
        const srcFile = path.join(COMPILER_SRC, rel);
        const outFile = path.join(outputDir, rel.replace(/\.ohn$/, '.js'));

        ensureDir(path.dirname(outFile));

        const ohnc = path.resolve(ROOT, 'core/bin/ohnc.js');
        // We can't use ohnc directly since it writes next to the source.
        // Instead, compile with Babel in-process.
        const babel = require('@babel/core');
        const code = fs.readFileSync(srcFile, 'utf-8');

        const result = babel.transformSync(code, {
            filename: srcFile,
            parserOpts: { plugins: ['typescript'] },
            presets: ['@babel/preset-env', ['@babel/preset-typescript', { allExtensions: true }]],
        });

        // Post-process: fix require paths from .ohn to .js
        const fixedCode = result.code.replace(/require\(['"]([^'"]*?)\.ohn['"]\)/g, "require('$1.js')");
        fs.writeFileSync(outFile, fixedCode);
        console.log('  Compiled: ' + rel + ' -> ' + path.relative(STAGE_DIR, outFile));
    }
    console.log('  Stage 0 complete.\n');
}

// ============================================================
// Stage N: Self-Hosting — use the compiler at stageDir to compile
// ============================================================
function stageN(n, stageDir, outputDir) {
    console.log('=== STAGE ' + n + ': Self-Hosting Compilation ===');
    cleanDir(outputDir);

    // Load the parser and generator from the previous stage's output
    const parserPath = path.join(stageDir, 'frontend/parser.js');
    const generatorPath = path.join(stageDir, 'codegen/generator.js');

    // Clear require cache to ensure fresh modules
    for (const key of Object.keys(require.cache)) {
        if (key.startsWith(stageDir)) {
            delete require.cache[key];
        }
    }

    const stageParser = require(parserPath);
    const stageGenerator = require(generatorPath);

    for (const rel of SOURCE_FILES) {
        const srcFile = path.join(COMPILER_SRC, rel);
        const outFile = path.join(outputDir, rel.replace(/\.ohn$/, '.js'));

        ensureDir(path.dirname(outFile));

        // Read the raw source
        const raw = fs.readFileSync(srcFile);
        const sourceBuffer = new Uint8Array(raw);

        // Parse
        const rootIndex = stageParser.parse(sourceBuffer);

        // Generate
        stageGenerator.generate(
            stageParser.get_ast_nodes(),
            stageParser.get_ast_extra(),
            stageParser.get_intern_pool(),
            rootIndex,
            outFile
        );

        // Post-process: fix require paths from .ohn to .js
        const rawOutput = fs.readFileSync(outFile, 'utf-8');
        const fixedOutput = rawOutput.replace(/require\(['"]([^'"]*?)\.ohn['"]\)/g, "require('$1.js')");
        fs.writeFileSync(outFile, fixedOutput);

        console.log('  Compiled: ' + rel + ' -> ' + path.relative(STAGE_DIR, outFile));
    }
    console.log('  Stage ' + n + ' complete.\n');
}

// ============================================================
// Verification: Compare stage2 and stage3
// ============================================================
function verify(dir1, dir2) {
    console.log('=== VERIFICATION: Comparing Stage 2 and Stage 3 ===');

    const hashes1 = hashDirectory(dir1);
    const hashes2 = hashDirectory(dir2);

    const files1 = Object.keys(hashes1).sort();
    const files2 = Object.keys(hashes2).sort();

    // Check same file set
    if (files1.length !== files2.length) {
        console.log('✗ FAIL: Different number of files');
        console.log('  Stage 2: ' + files1.length + ' files');
        console.log('  Stage 3: ' + files2.length + ' files');
        return false;
    }

    let allMatch = true;
    for (const file of files1) {
        if (hashes1[file] !== hashes2[file]) {
            console.log('  ✗ MISMATCH: ' + file);
            console.log('    Stage 2: ' + hashes1[file]);
            console.log('    Stage 3: ' + hashes2[file]);
            allMatch = false;
        } else {
            console.log('  ✓ MATCH: ' + file + ' (' + hashes1[file].substring(0, 12) + '...)');
        }
    }

    return allMatch;
}

// ============================================================
// Main
// ============================================================
function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  Ohnrscript Self-Hosting Bootstrap Protocol             ║');
    console.log('║  Proving the compiler can compile itself.               ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const stage1Dir = path.join(STAGE_DIR, 'stage1');
    const stage2Dir = path.join(STAGE_DIR, 'stage2');
    const stage3Dir = path.join(STAGE_DIR, 'stage3');

    ensureDir(STAGE_DIR);

    // Stage 0: Babel -> stage1/
    stage0(stage1Dir);

    // Stage 1: stage1/ compiler -> stage2/
    stageN(1, stage1Dir, stage2Dir);

    // Stage 2: stage2/ compiler -> stage3/
    stageN(2, stage2Dir, stage3Dir);

    // Verify stage2 == stage3
    const success = verify(stage2Dir, stage3Dir);

    console.log('');
    if (success) {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  ✓ SELF-HOSTING VERIFIED                                ║');
        console.log('║  Stage 2 and Stage 3 are byte-for-byte identical.       ║');
        console.log('║  The Ohnrscript compiler can compile itself.            ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
    } else {
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  ✗ SELF-HOSTING FAILED                                  ║');
        console.log('║  Stage 2 and Stage 3 differ. The compiler is not        ║');
        console.log('║  deterministic or has a code generation bug.            ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        process.exit(1);
    }
}

main();
