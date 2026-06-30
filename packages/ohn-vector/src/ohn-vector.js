"use strict";

// ohn-vector.ohn
// Official Ohnrscript Standard Library Package
// Zero-allocation Float32 Vector mapping.

/**
 * Zero-allocation view over a raw binary Float32 Buffer.
 * Bypasses V8 garbage collection by mapping directly to memory.
 */
function mapVector(buffer) {
  // A Node Buffer's .buffer property is the underlying ArrayBuffer
  // .byteOffset is where the Buffer starts within that ArrayBuffer
  // .length is the number of bytes in the Buffer
  // Float32Array requires length in elements, so buffer.length / 4
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
}
module.exports = {
  mapVector: mapVector
};