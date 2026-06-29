/**
 * Zero-allocation view over a raw binary Float32 Buffer.
 * 
 * @param {Buffer} buffer - A raw Node.js Buffer containing Float32 Little-Endian data
 * @returns {Float32Array} - A zero-copy view of the same memory
 */
function mapVector(buffer) {
    // A Node Buffer's .buffer property is the underlying ArrayBuffer
    // .byteOffset is where the Buffer starts within that ArrayBuffer
    // .length is the number of bytes in the Buffer
    // Float32Array requires length in elements, so buffer.length / 4
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
}

module.exports = { mapVector };
