# ohn-uuid

**Zero-allocation UUID v4 generator.** Uses a pre-allocated entropy pool (65KB) and a pre-allocated output buffer (36 bytes) to generate RFC 4122-compliant UUIDs with zero heap allocation per call.

**Target:** V8

---

## Import

```ohnrscript
const uuid = require('ohn-uuid');
```

---

## Functions

### `generateUUIDv4()`

Generates a UUID v4 string as a 36-byte `Uint8Array` (ASCII-encoded, hyphen-separated).

- **Parameters:** None
- **Returns:** `Uint8Array` (36 bytes) — The formatted UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)

> **Note:** Returns a reference to a shared output buffer. If you need to store multiple UUIDs, copy the bytes before generating the next one.

```ohnrscript
const id = uuid.generateUUIDv4();
// id is a 36-byte Uint8Array: "550e8400-e29b-41d4-a716-446655440000"
```

---

### `generateUUIDv4Raw()`

Generates a UUID v4 as 16 raw bytes (no formatting, no hyphens).

- **Parameters:** None
- **Returns:** `Uint8Array` (16 bytes) — The raw UUID bytes

```ohnrscript
const raw = uuid.generateUUIDv4Raw();
// raw is a 16-byte Uint8Array containing the binary UUID
```

---

### `fillEntropy()`

Refills the cryptographic entropy pool. Called automatically when the pool is exhausted. You typically don't need to call this manually.

- **Parameters:** None
- **Returns:** `void`

---

## Constants

| Export | Type | Description |
|---|---|---|
| `pool` | `Uint8Array(65536)` | The pre-allocated entropy pool |
| `outBuffer` | `Uint8Array(36)` | The pre-allocated ASCII output buffer |

---

## Design

The entropy pool holds 65,536 bytes of `crypto.randomFillSync()` output — enough for 4,096 UUIDs before refilling. The output buffer has hyphens pre-written at positions 8, 13, 18, and 23. Each `generateUUIDv4()` call maps 16 entropy bytes to 32 hex characters via a static lookup table, applying the UUID v4 version and variant bits.
