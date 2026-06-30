const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;

const files = [
    'uuid-native-benchmark',
    'test-uuid',
    'uuid-raw-benchmark.js',
    'uuid-benchmark.js'
];

console.log('🚀 Running all Ohnrscript UUID benchmarks...\n');

for (const file of files) {
    const fullPath = path.join(dir, file);
    if (!fs.existsSync(fullPath)) continue;

    console.log(`\n=============================================================`);
    console.log(`Executing ${file}`);
    console.log(`=============================================================`);
    try {
        if (file.endsWith('.js')) {
            execSync(`node --expose-gc ${fullPath}`, { stdio: 'inherit' });
        } else {
            execSync(fullPath, { stdio: 'inherit' });
        }
    } catch (e) {
        console.error(`❌ Error running ${file}`);
    }
}
console.log('\n✅ All UUID benchmarks completed.');
