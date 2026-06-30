const babel = require('@babel/core');
const cborAotPlugin = require('../src/plugins/babel-plugin-cbor-aot');
const cbor = require('cbor');

function transpile(code) {
  const result = babel.transformSync(code, {
    parserOpts: {
      plugins: [
        ['decorators', { decoratorsBeforeExport: true }],
        'typescript'
      ]
    },
    plugins: [cborAotPlugin]
  });
  return result.code;
}

function generateClassString(className, propertyCount) {
  let props = '';
  for (let i = 0; i < propertyCount; i++) {
    props += `
    prop${i}: number = ${i};
`;
  }
  return `
    @cbor
    class ${className} {
      ${props}
    }
    module.exports = ${className};
  `;
}

describe('CBOR Map Header Interoperability', () => {
  const testCases = [
    { count: 23, name: 'Small Map (<= 23)' },
    { count: 24, name: '1-byte length Map (24-255)' },
    { count: 40, name: '1-byte length Map (40, benchmark flagship)' },
    { count: 256, name: '2-byte length Map (256-65535)' }
  ];

  testCases.forEach(({ count, name }) => {
    it(`should round-trip encode/decode correctly for ${name} (${count} properties)`, () => {
      // Increase timeout for the 65536 test
      if (count >= 65536) {
        jest.setTimeout(30000);
      }
      
      const className = `TestClass${count}`;
      const classCode = generateClassString(className, count);
      const outputCode = transpile(classCode);
      
      const GeneratedClass = eval(`
        (function() {
          var module = { exports: {} };
          ${outputCode}
          return module.exports;
        })();
      `);
      
      const instance = new GeneratedClass();
      for (let i = 0; i < count; i++) {
        instance[`prop${i}`] = i;
      }
      // Test encoding
      const buf = instance.toCBOR();
      
      // Decode using standard cbor library
      const decoded = cbor.decode(buf);
      
      // Verify all properties are present and correct
      expect(Object.keys(decoded).length).toBe(count);
      expect(decoded.prop0).toBe(0);
      expect(decoded[`prop${count - 1}`]).toBe(count - 1);
      
      // Test decoding using AOT method
      const decodedAot = GeneratedClass.fromCBOR(buf);
      expect(decodedAot.prop0).toBe(0);
      expect(decodedAot[`prop${count - 1}`]).toBe(count - 1);
    });
  });
});
