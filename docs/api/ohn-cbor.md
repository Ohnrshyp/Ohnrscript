# ohn-cbor

**AOT CBOR serialization via the `@cbor` class decorator.** The `@cbor` system is not a standalone package — it is a Babel compiler transform (`babel-plugin-cbor-aot`) that analyzes your class fields at build time and injects zero-allocation `toCBOR()` and `fromCBOR()` methods.

**Target:** V8 (via `npx ohnc` or Babel pipeline)

---

## Usage

```ohnrscript
@cbor
class ServerStatus {
  isOnline: boolean;
  activeConnections: number;
  uptimeSeconds: number;
}

// After compilation, the class has these injected methods:

const status = new ServerStatus();
status.isOnline = true;
status.activeConnections = 42;
status.uptimeSeconds = 86400;

// Serialize to CBOR binary
const buf = status.toCBOR();

// Deserialize from CBOR binary
const decoded = ServerStatus.fromCBOR(buf);
```

---

## Compile Command

```bash
npx ohnc my-schema.ohn
# → produces my-schema.js with toCBOR()/fromCBOR() injected
```

---

## Injected Methods

### `instance.toCBOR()`

Serializes the instance to a CBOR binary `Uint8Array`. Writes field values directly as CBOR major types — no JSON conversion, no reflection.

- **Parameters:** None
- **Returns:** `Uint8Array` — CBOR-encoded binary

---

### `ClassName.fromCBOR(buffer)`

Deserializes a CBOR binary buffer back into a class instance.

- **Parameters:**
  - `buffer` (`Uint8Array | Buffer`) — CBOR-encoded binary data
- **Returns:** `ClassName` — A new instance with all fields populated

---

## Supported Field Types

| TypeScript Type | CBOR Major Type | Encoding |
|---|---|---|
| `number` | 0 (unsigned int) or 1 (negative int) | 32-bit integer, variable-length encoded |
| `boolean` | 7 (simple value) | `true` → `0xF5`, `false` → `0xF4` |
| `string` | 3 (text string) | UTF-8, length-prefixed |
| `Array<number>` | 4 (array) | Array of 32-bit integers |

---

## Validation

The CBOR serializer includes runtime validation:

- **Number fields:** Throws `Validation Error: Expected 32-bit integer` if the value is not a safe integer
- **String truncation:** Properly handles truncated buffers during deserialization
- **UTF-8 surrogates:** Correctly encodes/decodes surrogate pairs and multi-byte characters

---

## Two Phases

The CBOR AOT compiler has two phases:

### Phase 1: Fixed-Size Fields
Handles `number` and `boolean` fields. Buffer size is computed at compile time (fixed-length encoding).

### Phase 2: Dynamic-Length Fields
Handles `string` and `Array<number>` fields. Buffer size is computed at runtime (variable-length encoding for strings and arrays).

```ohnrscript
// Phase 2 example: dynamic-length fields
@cbor
class DeviceTelemetry {
  deviceId: string;           // Variable-length UTF-8
  measurements: Array<number>; // Variable-length array
  firmwareVersion: string;
  isOnline: boolean;           // Fixed-length
}
```

---

## Design

The `@cbor` transform is a Babel plugin (`babel-plugin-cbor-aot.js`, ~600 lines). At compile time, it:

1. Reads the class field declarations and their TypeScript type annotations
2. Computes the CBOR encoding strategy for each field
3. Generates the `toCBOR()` method with inline buffer writes (no loops over fields)
4. Generates the `fromCBOR()` method with inline buffer reads
5. Strips the `@cbor` decorator from the output

The result is a class with hardcoded serialization logic — no schema registry, no reflection, no dynamic dispatch.
