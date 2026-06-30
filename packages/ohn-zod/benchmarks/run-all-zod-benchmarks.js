const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('run-all'));

console.log('🚀 Running all Ohnrscript Zod benchmarks...\n');

for (const file of files) {
    console.log(`\n=============================================================`);
    console.log(`Executing ${file}`);
    console.log(`=============================================================`);
    try {
        execSync(`node --expose-gc ${path.join(dir, file)}`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ Error running ${file}`);
    }
}
console.log('\n✅ All Zod benchmarks completed.');
