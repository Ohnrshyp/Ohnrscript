const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const targetFile = path.join(__dirname, '../packages/ohn-zod/tests/ohn-zod.test.ohn');

function getTranspiledClass() {
    const babel = require('@babel/core');
    const cborPlugin = require('../core/src/plugins/babel-plugin-cbor-aot');
    const code = fs.readFileSync(targetFile, 'utf8');
    const result = babel.transformSync(code, {
      parserOpts: { plugins: ['typescript', ['decorators', { decoratorsBeforeExport: true }]] },
      plugins: [cborPlugin]
    });
    
    return eval(`
      (function() {
        var module = { exports: {} };
        ${result.code}
        return module.exports;
      })();
    `);
}

if (process.argv[2] === 'run-standard') {
    const { z } = require('zod');
    const { decode } = require('cbor-x');
    
    const UserPayloadSchema = z.object({
      age: z.number().int().min(1).max(1000),
      name: z.string().max(16)
    });
    
    const UserPayload = getTranspiledClass();
    const validObj = new UserPayload();
    validObj.age = 28;
    validObj.name = "Jordan";
    const validBuf = validObj.toCBOR();

    function standardValidationLoop() {
        let sum = 0;
        for (let i = 0; i < 10000; i++) {
            const parsed = decode(validBuf);
            const validated = UserPayloadSchema.parse(parsed);
            sum += validated.age;
        }
        return sum;
    }

    // Warmup
    standardValidationLoop();
    standardValidationLoop();
    
    // Force Optimization
    %OptimizeFunctionOnNextCall(standardValidationLoop);
    
    standardValidationLoop();
    console.log("Standard Validation Loop Complete");
    process.exit(0);
}

if (process.argv[2] === 'run-ohnrscript') {
    const UserPayload = getTranspiledClass();
    const validObj = new UserPayload();
    validObj.age = 28;
    validObj.name = "Jordan";
    const validBuf = validObj.toCBOR();

    function ohnrscriptValidationLoop() {
        let sum = 0;
        for (let i = 0; i < 10000; i++) {
            const validated = UserPayload.fromCBOR(validBuf);
            sum += validated.age;
        }
        return sum;
    }

    // Warmup
    ohnrscriptValidationLoop();
    ohnrscriptValidationLoop();
    
    // Force Optimization
    %OptimizeFunctionOnNextCall(ohnrscriptValidationLoop);
    
    ohnrscriptValidationLoop();
    console.log("Ohnrscript Validation Loop Complete");
    process.exit(0);
}

if (!process.argv[2]) {
    console.log("Starting Isolated V8 Tracing Benchmarks...");

    function runIsolatedProcess(name, arg) {
        console.log(`\n--- Running ${name} ---`);
        const logFile = path.join(__dirname, `v8-trace-${name}.log`);
        
        const result = spawnSync(process.execPath, [
            '--allow-natives-syntax',
            '--trace-opt',
            '--trace-deopt',
            '--trace-ic',
            __filename,
            arg
        ], {
            encoding: 'utf-8',
            maxBuffer: 1024 * 1024 * 50 // 50MB buffer for stderr
        });
        
        fs.writeFileSync(logFile, result.stderr || '');
        if (result.stdout) {
            console.log(result.stdout.trim());
        }
        console.log(`Saved V8 tracing logs to ${logFile}`);
    }

    runIsolatedProcess('standard', 'run-standard');
    runIsolatedProcess('ohnrscript', 'run-ohnrscript');
}
