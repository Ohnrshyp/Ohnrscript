"use strict";

// Auto-migrated to Ohnrscript from ohn-uuid.js

var crypto = require('crypto');

// Globally-scoped, single allocation for cryptographic entropy pool
// Size: 65536 bytes (can serve 4096 UUIDs before refilling)
var POOL_SIZE = 65536;
var pool = new Uint8Array(POOL_SIZE);
var poolOffset = POOL_SIZE;

// Globally-scoped, single allocation for formatted output
var outBuffer = new Uint8Array(36);

// Static lookup table for ASCII hex characters (0-9, a-f)
var hexLookup = new Uint8Array([48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
// 0-9
97, 98, 99, 100, 101, 102 // a-f
]);

// Hyphen byte code
var HYPHEN = 0x2d;

// Pre-fill hyphens in outBuffer
outBuffer[8] = HYPHEN;
outBuffer[13] = HYPHEN;
outBuffer[18] = HYPHEN;
outBuffer[23] = HYPHEN;
function fillEntropy() {
  if (poolOffset >= POOL_SIZE) {
    crypto.randomFillSync(pool);
    poolOffset = 0;
  }
}
function generateUUIDv4() {
  fillEntropy();

  // Map 16 bytes of entropy to 36 ASCII bytes in outBuffer
  var outIndex = 0;
  for (var i = 0; i < 16; i++) {
    // Skip hyphen positions
    if (outIndex === 8 || outIndex === 13 || outIndex === 18 || outIndex === 23) {
      outIndex++;
    }
    var _byte = pool[poolOffset++];

    // Apply UUID v4 mandatory bitwise operations
    if (i === 6) {
      _byte = _byte & 0x0f | 0x40;
    } else if (i === 8) {
      _byte = _byte & 0x3f | 0x80;
    }

    // High nibble
    outBuffer[outIndex++] = hexLookup[_byte >> 4];
    // Low nibble
    outBuffer[outIndex++] = hexLookup[_byte & 0x0f];
  }
  return outBuffer;
}
var rawBuffer = new Uint8Array(16);
function generateUUIDv4Raw() {
  fillEntropy();
  for (var i = 0; i < 16; i++) {
    var _byte2 = pool[poolOffset++];

    // Apply UUID v4 mandatory bitwise operations
    if (i === 6) {
      _byte2 = _byte2 & 0x0f | 0x40;
    } else if (i === 8) {
      _byte2 = _byte2 & 0x3f | 0x80;
    }
    rawBuffer[i] = _byte2;
  }
  return rawBuffer;
}
module.exports = {
  pool: pool,
  outBuffer: outBuffer,
  fillEntropy: fillEntropy,
  generateUUIDv4: generateUUIDv4,
  generateUUIDv4Raw: generateUUIDv4Raw
};