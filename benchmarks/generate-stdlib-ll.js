'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const COMPILER_FRONTEND = path.join(ROOT, 'compiler/src/frontend/parser.ohn');
const COMPILER_BACKEND = path.join(ROOT, 'compiler/src/codegen/generator-llvm.ohn');

const PACKAGES = [
    { name: 'ohn-uuid', src: 'packages/ohn-uuid/src/ohn-uuid.js' },
    { name: 'ohn-ws', src: 'packages/ohn-ws/src/ohn-ws.js' },
    { name: 'ohn-cookie', src: 'packages/ohn-cookie/src/ohn-cookie.js' }
];

console.log('═══════════════════════════════════════════════════════');
console.log('  Generating LLVM IR for Standard Libraries');
console.log('═══════════════════════════════════════════════════════');

let allSuccess = true;

for (const pkg of PACKAGES) {
    // Clear require cache for clean parse/generate
    Object.keys(require.cache)
        .filter(k => k.includes('generator') || k.includes('parser.ohn'))
        .forEach(k => delete require.cache[k]);

    const parser = require(COMPILER_FRONTEND);
    const generator = require(COMPILER_BACKEND);

    const srcPath = path.join(ROOT, pkg.src);
    const outPath = path.join(ROOT, `tmp/${pkg.name}.ll`); // Output inside the workspace

    // Ensure tmp exists
    if (!fs.existsSync(path.join(ROOT, 'tmp'))) {
        fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
    }

    process.stdout.write(`  Compiling ${pkg.name}.js → LLVM IR... `);

    try {
        const src = fs.readFileSync(srcPath);
        const rootIndex = parser.parse(new Uint8Array(src));
        
        generator.generate(
            parser.get_ast_nodes(), 
            parser.get_ast_extra(), 
            parser.get_intern_pool(), 
            rootIndex, 
            outPath
        );
        
        // --- POST-PROCESSING LLVM IR (Phase 4C Host Memory Injection) ---
        // Because Ohnrscript is designed for WebAssembly / Host environments,
        // it leaves large buffer allocations to the host (via NODE_NEW_EXPRESSION).
        // Our compiler currently emits fallback '0' null pointers for these.
        // We patch the generated artifacts here so our C test harness can safely 
        // inject 64-bit pointers without them being overwritten by the IR.
        let ir = fs.readFileSync(outPath, 'utf8');
        ir = ir.replace(/= global i32 0/g, '= global ptr null');
        ir = ir.replace(/store i32 %t\d+, ptr @(outBuffer|pool|hexLookup|rawBuffer|crypto)/g, '; (removed pointer zeroing by build script)');
        fs.writeFileSync(outPath, ir);
        
        const size = fs.statSync(outPath).size;
        console.log(`done (${size} bytes)`);

        process.stdout.write(`  Validating ${pkg.name}.ll with llvm-as... `);
        execSync(`llvm-as ${outPath} -o /dev/null`, { stdio: 'ignore' });
        console.log(`PASS ✓`);

    } catch (err) {
        console.error(`\n  ERROR compiling or validating ${pkg.name}:`);
        console.error(err.message);
        allSuccess = false;
    }
    console.log('');
}

if (!allSuccess) {
    process.exit(1);
}
