const { generateUUIDv4, generateUUIDv4Raw } = require('../src/ohn-uuid.js');

describe('UUIDv4 Generation', () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('should generate a valid formatted UUIDv4 string', () => {
    const buf = generateUUIDv4();
    const uuidStr = Buffer.from(buf).toString('utf8');
    expect(uuidStr).toMatch(uuidRegex);
  });

  it('should generate valid raw UUIDv4 bytes', () => {
    const raw = generateUUIDv4Raw();
    
    // Check version nibble of byte 6 (must be 0x40)
    expect(raw[6] >> 4).toBe(4);
    
    // Check variant bits of byte 8 (must be 0x80 or 10xx in binary)
    expect(raw[8] >> 6).toBe(2);
  });
  
  it('should pass UUIDv4 validation across many iterations', () => {
    for (let i = 0; i < 1000; i++) {
      const buf = generateUUIDv4();
      const uuidStr = Buffer.from(buf).toString('utf8');
      expect(uuidStr).toMatch(uuidRegex);
    }
  });
});
