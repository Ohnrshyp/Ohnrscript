const babelParser = require('@babel/parser');
const fs = require('fs');

const NODE_TYPES = {
    Program: 0,
    VariableDeclaration: 1,
    NumericLiteral: 2,
    StringLiteral: 3,
    BlockStatement: 4
};

const VAR_KINDS = {
    "var": 0,
    "let": 1,
    "const": 2
};

function serialize(node) {
    if (!node) return Buffer.alloc(0);

    let typeEnum = 0;
    let flags = 0;
    let payload = Buffer.alloc(0);
    let children = [];

    switch (node.type) {
        case 'Program':
            typeEnum = NODE_TYPES.Program;
            children = node.body || [];
            break;
            
        case 'BlockStatement':
            typeEnum = NODE_TYPES.BlockStatement;
            children = node.body || [];
            break;
            
        case 'VariableDeclaration':
            typeEnum = NODE_TYPES.VariableDeclaration;
            flags = VAR_KINDS[node.kind] !== undefined ? VAR_KINDS[node.kind] : 0;
            
            // DOD flattening: We extract the identifier and inline it into the VariableDeclaration payload.
            // This avoids creating separate nodes for VariableDeclarator and Identifier which reduces overhead.
            if (node.declarations && node.declarations.length > 0) {
                const decl = node.declarations[0];
                if (decl.id && decl.id.type === 'Identifier') {
                    const nameBuf = Buffer.from(decl.id.name, 'utf8');
                    const nameLenBuf = Buffer.alloc(4);
                    nameLenBuf.writeUInt32LE(nameBuf.length, 0);
                    payload = Buffer.concat([nameLenBuf, nameBuf]);
                }
                if (decl.init) {
                    children = [decl.init];
                }
            }
            break;
            
        case 'NumericLiteral':
            typeEnum = NODE_TYPES.NumericLiteral;
            payload = Buffer.alloc(8);
            payload.writeDoubleLE(node.value, 0);
            break;
            
        case 'StringLiteral':
            typeEnum = NODE_TYPES.StringLiteral;
            const strBuf = Buffer.from(node.value, 'utf8');
            const strLenBuf = Buffer.alloc(4);
            strLenBuf.writeUInt32LE(strBuf.length, 0);
            payload = Buffer.concat([strLenBuf, strBuf]);
            break;
            
        case 'ExpressionStatement':
            // Unpack expression statement wrapper to expose the literal directly
            return serialize(node.expression);
            
        default:
            // Warn the developer instead of failing silently on unsupported nodes
            console.warn(`[Warning] Unsupported AST node type encountered: ${node.type}. Skipping.`);
            return Buffer.alloc(0);
    }

    const childBuffers = children.filter(Boolean).map(child => serialize(child));
    const childrenBuffer = Buffer.concat(childBuffers);

    // Calculate total length (Header + Payload + Children)
    const totalLength = 8 + payload.length + childrenBuffer.length;

    // Create header (8 bytes)
    // 0x00: Node Type Enum (Uint16)
    // 0x02: Flags Bitmask (Uint16)
    // 0x04: Total Byte Length (Uint32)
    const header = Buffer.alloc(8);
    header.writeUInt16LE(typeEnum, 0);
    header.writeUInt16LE(flags, 2);
    header.writeUInt32LE(totalLength, 4);

    return Buffer.concat([header, payload, childrenBuffer]);
}

function compileCode(code) {
    const ast = babelParser.parse(code, {
        sourceType: "module",
        plugins: []
    });

    return serialize(ast.program);
}

// Basic CLI functionality
if (require.main === module) {
    const inputFile = process.argv[2];
    let code = '';
    
    if (inputFile) {
        code = fs.readFileSync(inputFile, 'utf8');
        const buffer = compileCode(code);
        process.stdout.write(buffer);
    } else {
        // Read from stdin
        code = fs.readFileSync(0, 'utf8');
        const buffer = compileCode(code);
        process.stdout.write(buffer);
    }
}

module.exports = {
    compileCode,
    NODE_TYPES,
    VAR_KINDS
};
