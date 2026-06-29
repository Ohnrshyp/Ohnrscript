#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error("Usage: node scaffold.js <input.json> [ClassName]");
  process.exit(1);
}

const inputFile = process.argv[2];
let className = process.argv[3] || path.basename(inputFile, '.json');
// PascalCase the class name
className = className.charAt(0).toUpperCase() + className.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase());

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
