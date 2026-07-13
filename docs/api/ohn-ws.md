# ohn-ws

**Zero-allocation WebSocket frame parser.** Parses WebSocket frames by mutating the incoming buffer in-place to unmask the payload — completely bypassing buffer allocation and garbage collection.

**Target:** V8

---

## Import

```ohnrscript
const ws = require('ohn-ws');
```

---

## Types

### `WSFrame`

```ohnrscript
type WSFrame = {
  fin: boolean;          // Final fragment flag
  opcode: number;        // Frame opcode (1=text, 2=binary, 8=close, 9=ping, 10=pong)
  payloadStart: number;  // Byte offset where the unmasked payload begins
  payloadLength: number; // Length of the payload in bytes
};
```

---

## Functions

### `parseFrame(buffer)`

Parses a single WebSocket frame from a raw buffer. **Mutates the buffer in-place** to unmask the payload — this is the zero-allocation design.

- **Parameters:**
  - `buffer` (`Buffer`) — The raw WebSocket frame data
- **Returns:** `WSFrame | null` — The parsed frame, or `null` if the frame is incomplete

```ohnrscript
const frame = ws.parseFrame(rawBuffer);
if (frame !== null) {
    // The payload has been unmasked in-place inside rawBuffer
    const payload = rawBuffer.subarray(frame.payloadStart, frame.payloadStart + frame.payloadLength);
    // frame.opcode tells you the type: 1=text, 2=binary, etc.
}
```

**How the zero-allocation unmasking works:**

The WebSocket protocol requires client-to-server messages to be XOR-masked with a 4-byte key. Standard parsers allocate a new buffer for the unmasked output. `ohn-ws` instead XORs the mask directly into the original buffer:

```
buffer[payloadStart + i] ^= maskKey[i & 3]
```

This destroys the masked state and reveals the payload in the same memory location — zero copies, zero allocation.

---

## Supported Frame Formats

| Payload Length | Encoding |
|---|---|
| 0–125 bytes | Inline in byte 1 |
| 126–65535 bytes | Extended 16-bit (2 additional bytes) |
| 65536+ bytes | Extended 64-bit (8 additional bytes) |
