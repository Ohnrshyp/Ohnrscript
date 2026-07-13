# ohn-zod

**Zero-allocation AOT validation decorators.** Provides compile-time type annotations for CBOR schema fields. These decorators are stripped by the Ohnrscript compiler at build time and used to generate validation logic.

**Target:** V8

---

## Import

```ohnrscript
const zod = require('ohn-zod');
```

---

## Types

### `UInt32Validation`

```ohnrscript
type UInt32Validation = {
  min?: number;   // Minimum allowed value
  max?: number;   // Maximum allowed value
};
```

### `StringValidation`

```ohnrscript
type StringValidation = {
  maxLength?: number;  // Maximum allowed string length
};
```

---

## Decorators

### `@cbor`

Marks a class for CBOR AOT serialization. Applied to the class declaration. The compiler uses this to generate `toCBOR()` and `fromCBOR()` methods.

```ohnrscript
@cbor
class MyPacket {
  value: number;
}
```

---

### `uint32(rules?)`

Property decorator that validates a 32-bit unsigned integer field at compile time.

- **Parameters:**
  - `rules` (`UInt32Validation`, optional) — Validation constraints
- **Returns:** `PropertyDecorator`

```ohnrscript
@cbor
class SensorReading {
  @uint32({ min: 0, max: 4294967295 })
  temperature;
}
```

---

### `string(rules?)`

Property decorator that validates a string field at compile time.

- **Parameters:**
  - `rules` (`StringValidation`, optional) — Validation constraints
- **Returns:** `PropertyDecorator`

```ohnrscript
@cbor
class UserProfile {
  @string({ maxLength: 255 })
  username;
}
```

---

## Design

These decorators are **compile-time annotations only**. The Ohnrscript AOT compiler reads them during the build phase and generates validation code inline. At runtime, the decorator functions themselves are no-ops — they are completely stripped from the output.
