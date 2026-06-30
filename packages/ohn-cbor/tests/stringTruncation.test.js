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
  class StringPacket {
    value: string = "";
  }
  module.exports = StringPacket;
`;

const outputCode = transpile(inputCode);
const StringPacket = eval(`
  (function() {
    var module = { exports: {} };
    ${outputCode}
    return module.exports;
  })();
`);

describe('AOT String Truncation Validation', () => {
  it('should successfully decode a valid string', () => {
    const packet = new StringPacket();
    packet.value = "hello world";
    const buf = packet.toCBOR();
    const decoded = StringPacket.fromCBOR(buf);
    expect(decoded.value).toBe("hello world");
  });

  it('should throw when the buffer is truncated (preventing silent clamping)', () => {
    const packet = new StringPacket();
    packet.value = "this is a long string that will be truncated";
    const buf = packet.toCBOR();
    
    // Slice off the last 5 bytes
    const truncatedBuf = buf.slice(0, buf.length - 5);
    
    expect(() => {
      StringPacket.fromCBOR(truncatedBuf);
    }).toThrow(/Validation Error: Unexpected end of buffer during string decode/);
  });
});
