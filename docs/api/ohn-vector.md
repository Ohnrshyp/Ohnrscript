# ohn-vector

**Zero-allocation Float32 vector mapping.** Creates a `Float32Array` view directly over a raw binary buffer, bypassing V8 garbage collection by mapping to existing memory instead of copying.

**Target:** V8

---

## Import

```ohnrscript
const vector = require('ohn-vector');
```

---

## Functions

### `mapVector(buffer)`

Creates a `Float32Array` view over an existing `Uint8Array` or `Buffer` without copying data. The returned array shares the same underlying `ArrayBuffer`.

- **Parameters:**
  - `buffer` (`Uint8Array | Buffer`) — The raw binary buffer containing float data
- **Returns:** `Float32Array` — A typed view over the same memory

```ohnrscript
// Network buffer containing 4 floats (16 bytes)
const raw = Buffer.alloc(16);
raw.writeFloatLE(1.0, 0);
raw.writeFloatLE(2.0, 4);
raw.writeFloatLE(3.0, 8);
raw.writeFloatLE(4.0, 12);

const floats = vector.mapVector(raw);
// floats[0] → 1.0, floats[1] → 2.0, etc.
// No data was copied — floats points to the same memory as raw
```

---

## Design

This is the bridge between raw network buffers and typed float operations. When a 1536-dimension AI embedding vector arrives as raw bytes over the network, `mapVector()` maps it to a `Float32Array` in a single pointer operation — no allocation, no copy. This is what enables the 55x speedup over `DataView` in Ohnrscript's vector parsing benchmarks.
