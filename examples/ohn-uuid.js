const crypto = require('crypto');

// Globally-scoped, single allocation for cryptographic entropy
// This avoids V8 garbage collection during UUID generation
const buffer = new Uint8Array(16);

function fillEntropy() {
  // Fill the static buffer with random bytes without allocating a new array
  crypto.randomFillSync(buffer);

  // Apply UUID v4 mandatory bitwise operations
  // Version 4: Set the 4 most significant bits of the 7th byte (index 6) to 0100 (0x40)
  buffer[6] = (buffer[6] & 0x0f) | 0x40;
  
  // Variant 1: Set the 2 most significant bits of the 9th byte (index 8) to 10 (0x80)
  buffer[8] = (buffer[8] & 0x3f) | 0x80;
}

module.exports = {
  buffer,
  fillEntropy
};
