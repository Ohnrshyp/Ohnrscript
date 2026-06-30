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

describe('UTF-8 Unpaired Surrogate Handling', () => {
  it('should encode a valid surrogate pair correctly', () => {
    const packet = new StringPacket();
    packet.value = "🍎"; // U+1F34E, surrogate pair D83C DF4E
    const buf = packet.toCBOR();
    // String length should be 4 bytes
    const strBytes = buf.slice(buf.length - 4);
    expect(strBytes[0]).toBe(0xf0);
    expect(strBytes[1]).toBe(0x9f);
    expect(strBytes[2]).toBe(0x8d);
    expect(strBytes[3]).toBe(0x8e);
  });

  it('should replace an unpaired high surrogate with U+FFFD', () => {
    const packet = new StringPacket();
    packet.value = "\uD800"; // Unpaired high surrogate
    const buf = packet.toCBOR();
    const strBytes = buf.slice(buf.length - 3);
    expect(strBytes[0]).toBe(0xef);
    expect(strBytes[1]).toBe(0xbf);
    expect(strBytes[2]).toBe(0xbd);
  });

  it('should replace an unpaired low surrogate with U+FFFD and preserve following characters', () => {
    const packet = new StringPacket();
    packet.value = "\uDC00x"; // Unpaired low surrogate followed by 'x'
    const buf = packet.toCBOR();
    const strBytes = buf.slice(buf.length - 4);
    expect(strBytes[0]).toBe(0xef);
    expect(strBytes[1]).toBe(0xbf);
    expect(strBytes[2]).toBe(0xbd);
    expect(strBytes[3]).toBe('x'.charCodeAt(0));
  });

  it('should replace a trailing high surrogate with U+FFFD', () => {
    const packet = new StringPacket();
    packet.value = "hello\uD800"; // Trailing high surrogate
    const buf = packet.toCBOR();
    const strBytes = buf.slice(buf.length - 3);
    expect(strBytes[0]).toBe(0xef);
    expect(strBytes[1]).toBe(0xbf);
    expect(strBytes[2]).toBe(0xbd);
  });
});
