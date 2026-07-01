const { compileCode, NODE_TYPES } = require('./serializer');
const assert = require('assert');

const code = `
let magic = 42;
{
    const greeting = "hello";
    var pi = 3.14;
}
let b = 100;
`;

console.log("Compiling code...");
const binaryAst = compileCode(code);
console.log(`Binary AST generated. Total size: ${binaryAst.length} bytes\n`);

console.log("--- Validating O(1) Skipping ---");

let offset = 0;
// Read root node header
const rootType = binaryAst.readUInt16LE(offset);
const rootFlags = binaryAst.readUInt16LE(offset + 2);
const rootLength = binaryAst.readUInt32LE(offset + 4);

assert.strictEqual(rootType, NODE_TYPES.Program, "Root must be a Program node");
assert.strictEqual(rootLength, binaryAst.length, "Program length must equal total buffer size");

console.log(`Program Node: Length=${rootLength} bytes`);

// Offset to first child is 8 (the header size)
let currentChildOffset = 8;
let childIndex = 0;

while (currentChildOffset < rootLength) {
    const childType = binaryAst.readUInt16LE(currentChildOffset);
    const childFlags = binaryAst.readUInt16LE(currentChildOffset + 2);
    const childLength = binaryAst.readUInt32LE(currentChildOffset + 4);

    const typeName = Object.keys(NODE_TYPES).find(key => NODE_TYPES[key] === childType);
    console.log(`[Child ${childIndex}] Type: ${typeName}, Flags: ${childFlags}, Length: ${childLength} bytes`);

    assert(currentChildOffset + childLength <= rootLength, "Child length exceeds parent bounds");
    
    if (childType === NODE_TYPES.BlockStatement) {
        console.log(`  -> Diving into BlockStatement to verify its children...`);
        let blockChildOffset = currentChildOffset + 8; // skip header
        const blockEnd = currentChildOffset + childLength;
        let blockChildIndex = 0;
        
        while (blockChildOffset < blockEnd) {
            const bcType = binaryAst.readUInt16LE(blockChildOffset);
            const bcLength = binaryAst.readUInt32LE(blockChildOffset + 4);
            const bcName = Object.keys(NODE_TYPES).find(key => NODE_TYPES[key] === bcType);
            console.log(`    [Block Child ${blockChildIndex}] Type: ${bcName}, Length: ${bcLength} bytes`);
            
            // O(1) skip to next block child
            blockChildOffset += bcLength;
            blockChildIndex++;
        }
        assert.strictEqual(blockChildOffset, blockEnd, "BlockStatement children lengths must add up to BlockStatement length exactly");
    }

    // O(1) Skip to next child of Program by adding the current child's length
    currentChildOffset += childLength;
    childIndex++;
}

assert.strictEqual(currentChildOffset, rootLength, "Child lengths must add up to Program length exactly");
console.log("\n✅ O(1) child skipping validation successful. The byte_length headers accurately allow jumping over entire trees.");
