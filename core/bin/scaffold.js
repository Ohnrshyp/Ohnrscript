#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error("Usage: node scaffold.js <input.json | input.js | input.ts> [ClassName]");
  process.exit(1);
}

const inputFile = process.argv[2];
const ext = path.extname(inputFile);
let className = process.argv[3] || path.basename(inputFile, ext);
// PascalCase the class name
className = className.charAt(0).toUpperCase() + className.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase());

if (ext === '.js' || ext === '.ts') {
  // Migration Mode: js2ohn / ts2ohn
  try {
    const content = fs.readFileSync(inputFile, 'utf-8');
    let output = `// Auto-migrated to Ohnrscript from ${path.basename(inputFile)}\n\n`;
    output += content;
    console.log(output);
    process.exit(0);
  } catch (err) {
    console.error(`Failed to read ${ext} file:`, err.message);
    process.exit(1);
  }
} else if (ext === '.json') {
  // JSON Mode: Generate @cbor class
  let json;
  try {
    json = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  } catch (err) {
    console.error("Failed to parse JSON file:", err.message);
    process.exit(1);
  }

  function inferType(val) {
    if (val === null) return 'string'; // Default to string if null
    if (typeof val === 'string') return 'string';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'boolean') return 'boolean';
    if (Array.isArray(val)) {
      if (val.length > 0) {
        const elType = inferType(val[0]);
        if (elType === 'number' && val.length > 100) {
          return `float32[${val.length}]`;
        }
        return `Array<${elType}>`;
      }
      return 'Array<any>';
    }
    if (typeof val === 'object') {
      return 'any';
    }
    return 'string';
  }

  let output = `// Auto-generated Ohnrscript Schema from ${path.basename(inputFile)}\n`;
  output += `@cbor\nclass ${className} {\n`;

  for (const [key, value] of Object.entries(json)) {
    const type = inferType(value);
    output += `  ${key}: ${type};\n`;
  }

  output += `\n  constructor(`;
  const keys = Object.keys(json);
  output += keys.join(', ');
  output += `) {\n`;

  for (const key of keys) {
    output += `    this.${key} = ${key};\n`;
  }

  output += `  }\n}\n\nmodule.exports = ${className};\n`;

  console.log(output);
} else {
  console.error("Unsupported file extension. Please provide a .json, .js, or .ts file.");
  process.exit(1);
}
