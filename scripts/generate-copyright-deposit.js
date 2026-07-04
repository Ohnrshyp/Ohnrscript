const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'Ohnrscript_Copyright_Deposit.md');

// The most critical files that prove the novel architecture
const FILES_TO_INCLUDE = [
    'compiler/src/core/arena.ohn',
    'compiler/src/frontend/parser.ohn',
    'compiler/src/codegen/generator-llvm.ohn',
    'packages-llvm/ohn-kernel/src/kernel.ohn',
    'packages-llvm/ohn-kernel/boot/boot.c',
    'packages-llvm/three.ohn/three.ohn'
];

const header = `
# Copyright Deposit: Ohnrscript
**Author:** Jordan Kugler
**Year of Completion:** 2026

This document contains identifying portions of the source code for Ohnrscript, demonstrating its novel Ahead-Of-Time (AOT) compilation architecture, zero-allocation parser, and its capacity to compile JavaScript syntax directly to LLVM Intermediate Representation (IR) and bare-metal executable machine code.

---
`;

let outputContent = header.trim() + '\n\n';

for (const relativePath of FILES_TO_INCLUDE) {
    const fullPath = path.join(REPO_ROOT, relativePath);
    
    if (!fs.existsSync(fullPath)) {
        console.error(`Warning: ${relativePath} not found.`);
        continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    
    outputContent += `## File: ${relativePath}\n\n`;
    outputContent += "```javascript\n";
    outputContent += content;
    if (!content.endsWith('\n')) {
        outputContent += '\n';
    }
    outputContent += "```\n\n";
}

fs.writeFileSync(OUTPUT_FILE, outputContent);

console.log(`✅ Copyright deposit generated at: ${OUTPUT_FILE}`);
console.log(`   Total size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
console.log('   You can export this Markdown file to a PDF for submission to the US Copyright Office.');
