const assert = require('assert');
const { parseFrame } = require('./ohn-ws');

// Helper to manually create a masked WS frame for testing
function createMaskedFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  
  // Create frame buffer (2 bytes header + 4 bytes mask + payload length)
  const frame = Buffer.alloc(2 + 4 + len);
  
  // FIN=1, Text frame (opcode 1)
  frame[0] = 0x81; 
  // Masked=1, Length=len (assuming < 126 for simplicity in test)
  frame[1] = 0x80 | len; 
  
  // Dummy mask key
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  mask.copy(frame, 2);
  
  // Mask the payload manually before putting it into the frame
  for (let i = 0; i < len; i++) {
    frame[6 + i] = payload[i] ^ mask[i % 4];
  }
  
  return frame;
}

const originalText = "Hello Ohnrscript WebSocket!";
const frameBuffer = createMaskedFrame(originalText);

console.log("Raw Masked Frame Buffer:", frameBuffer.toString('hex'));

// Parse and unmask in-place
const result = parseFrame(frameBuffer);

console.log("Parsed Metadata:", result);

// Slice the payload to verify it was unmasked in-place correctly
const extractedText = frameBuffer.toString('utf8', result.payloadStart, result.payloadStart + result.payloadLength);

console.log(`Expected: "${originalText}"`);
console.log(`Extracted: "${extractedText}"`);

assert.strictEqual(result.fin, true);
assert.strictEqual(result.opcode, 1);
assert.strictEqual(extractedText, originalText);
console.log("✅ ohn-ws zero-allocation unmasking passed!");
