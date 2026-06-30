const fs = require('fs');
const { execSync } = require('child_process');

// Roughly 614.4 MB dataset (100,000 vectors)
const VECTOR_SIZE = 1536;
const NUM_VECTORS = 100_000;
const BIN_FILE = './vectors.bin';
const JSON_FILE = './vectors.json';

if (!fs.existsSync(BIN_FILE) || !fs.existsSync(JSON_FILE)) {
    console.log(`Generating ${NUM_VECTORS} vectors (Vector size: ${VECTOR_SIZE})...`);
    console.log("Writing 614 MB binary and JSON payloads to disk (this will take 15 seconds)...");
    
    const binFd = fs.openSync(BIN_FILE, 'w');
    const jsonFd = fs.openSync(JSON_FILE, 'w');
    fs.writeSync(jsonFd, '[');

    const chunk = Buffer.allocUnsafe(VECTOR_SIZE * 4);
    for (let i = 0; i < NUM_VECTORS; i++) {
        const floats = [];
        for (let j = 0; j < VECTOR_SIZE; j++) {
            const val = Math.random();
            chunk.writeFloatLE(val, j * 4);
            floats.push(val);
        }
        fs.writeSync(binFd, chunk);
        
        const jsonStr = JSON.stringify(floats) + (i === NUM_VECTORS - 1 ? '' : ',');
        fs.writeSync(jsonFd, jsonStr);
        
        if (i > 0 && i % 20000 === 0) console.log(`  ...generated ${i} vectors`);
    }
    fs.writeSync(jsonFd, ']');
    fs.closeSync(binFd);
    fs.closeSync(jsonFd);
    console.log("Finished generating files.\n");
} else {
    console.log("Files already exist. Skipping generation.\n");
}

console.log("==========================================================");
console.log("=== RUNNING JSON.PARSE TEST (EXPECTING OOM CRASH) ========");
console.log("==========================================================");
try {
    // Restrict Node.js memory to 1.5GB to forcefully demonstrate the OOM crash on a 600MB payload
    execSync('node --max-old-space-size=1536 benchmarks/runner-json.js', { stdio: 'inherit' });
} catch (e) {
    console.log("\n❌ JSON Test Crashed (As Expected)");
    console.log("   Because 600MB of JSON text requires >2GB of RAM to parse into JS objects.\n");
}

console.log("==========================================================");
console.log("=== RUNNING OHNRSCRIPT ZERO-COPY TEST ====================");
console.log("==========================================================");
try {
    execSync('node --max-old-space-size=1536 benchmarks/runner-ohn.js', { stdio: 'inherit' });
} catch (e) {
    console.log("\n❌ Ohnrscript Test Crashed!\n");
}
