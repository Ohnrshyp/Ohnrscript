const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packagesDir = __dirname;
const packages = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

console.log('🚀 Running ALL package benchmarks for Ohnrscript...\n');

for (const pkg of packages) {
    const benchmarksDir = path.join(packagesDir, pkg, 'benchmarks');
    if (!fs.existsSync(benchmarksDir)) continue;

    const files = fs.readdirSync(benchmarksDir);
    
    // Determine what to run for this package
    let scriptsToRun = [];

    // If we previously generated a 'run-all' script for this package, use that
    const runAllScript = files.find(f => f.startsWith('run-all-') && f.endsWith('.js'));
    
    if (runAllScript) {
        scriptsToRun.push(path.join(benchmarksDir, runAllScript));
    } else {
        // Otherwise, it's a package with individual benchmarks (like ohn-cbor, ohn-cookie, ohn-ws)
        const jsBenchmarks = files.filter(f => f.endsWith('.js') && f.includes('benchmark'));
        for (const file of jsBenchmarks) {
            scriptsToRun.push(path.join(benchmarksDir, file));
        }
    }

    for (const scriptPath of scriptsToRun) {
        const displayPath = path.relative(packagesDir, scriptPath);
        console.log(`\n=============================================================`);
        console.log(`Executing ${displayPath}`);
        console.log(`=============================================================`);
        try {
            execSync(`node --expose-gc ${scriptPath}`, { stdio: 'inherit' });
        } catch (e) {
            console.error(`❌ Error running ${displayPath}`);
        }
    }
}

console.log('\n✅ All package benchmarks completed.');
