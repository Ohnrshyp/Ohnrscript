"use strict";

// Auto-migrated to Ohnrscript from ohn-ws.js

// Zero-allocation WebSocket frame parser.
// Mutates the incoming buffer in-place to unmask the payload, completely bypassing 
// V8 Buffer allocation and garbage collection.
function parseFrame(buffer) {
  if (buffer.length < 2) return null; // Incomplete frame

  var byte0 = buffer[0];
  var byte1 = buffer[1];
  var fin = (byte0 & 0x80) === 0x80;
  var opcode = byte0 & 0x0f;
  var masked = (byte1 & 0x80) === 0x80;
  var payloadLength = byte1 & 0x7f;
  var offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    var high = buffer.readUInt32BE(2);
    var low = buffer.readUInt32BE(6);
    payloadLength = high * 0x100000000 + low;
    offset += 8;
  }
  var maskKey;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    maskKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + payloadLength) {
    return null; // Incomplete payload chunk
  }
  var payloadStart = offset;

  // IN-PLACE UNMASKING (The Zero-Allocation Magic)
  // Mutate the buffer directly to destroy the masked state and reveal the payload
  if (masked && payloadLength > 0) {
    // 32-bit chunk optimization can be added for massive frames, but for simplicity
    // and raw byte-level performance, the direct loop is incredibly fast in V8.
    for (var i = 0; i < payloadLength; i++) {
      buffer[payloadStart + i] ^= maskKey[i & 3]; // i % 4
    }
  }
  return {
    fin: fin,
    opcode: opcode,
    payloadStart: payloadStart,
    payloadLength: payloadLength
  };
}
module.exports = {
  parseFrame: parseFrame
};