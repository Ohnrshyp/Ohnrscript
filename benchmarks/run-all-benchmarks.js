const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;

const suites = [
    path.join(dir, 'suites/core'),
    path.join(dir, 'suites/protobuf')
];

let benchmarkFiles = [];
for (const suite of suites) {
    if (fs.existsSync(suite)) {
        const files = fs.readdirSync(suite)
            .filter(f => f.endsWith('.js'))
            .map(f => path.join(suite, f));
        benchmarkFiles = benchmarkFiles.concat(files);
    }
}

console.log('🚀 Running all Ohnrscript benchmarks...\n');

for (const filePath of benchmarkFiles) {
    const fileName = path.basename(filePath);
    console.log(`\n=============================================================`);
    console.log(`Executing ${fileName}`);
    console.log(`=============================================================`);
    try {
        execSync(`node --expose-gc ${filePath}`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ Error running ${fileName}`);
    }
}
console.log('\n✅ All benchmarks completed.');
