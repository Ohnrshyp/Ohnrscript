const babel = require('@babel/core');
const cborAotPlugin = require('../../../core/src/plugins/babel-plugin-cbor-aot');

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

const inputCode = `
  @cbor
  class NumberPacket {
    value: number = 0;
  }
  module.exports = NumberPacket;
`;

const outputCode = transpile(inputCode);
const NumberPacket = eval(`
  (function() {
    var module = { exports: {} };
    ${outputCode}
    return module.exports;
  })();
`);

describe('AOT Number Validation', () => {
  it('should successfully encode a valid 32-bit integer', () => {
    const packet = new NumberPacket();
    packet.value = 42;
    expect(() => packet.toCBOR()).not.toThrow();
  });

  it('should throw when encoding a float (preventing silent decimal truncation)', () => {
    const packet = new NumberPacket();
    packet.value = 42.5;
    expect(() => packet.toCBOR()).toThrow(/Validation Error: Expected 32-bit integer for property value/);
  });

  it('should throw when encoding an integer > 2147483647 (preventing silent overflow)', () => {
    const packet = new NumberPacket();
    packet.value = 3000000000;
    expect(() => packet.toCBOR()).toThrow(/Validation Error: Expected 32-bit integer for property value/);
  });

  it('should throw when encoding an integer < -2147483648 (preventing silent underflow)', () => {
    const packet = new NumberPacket();
    packet.value = -3000000000;
    expect(() => packet.toCBOR()).toThrow(/Validation Error: Expected 32-bit integer for property value/);
  });
});
