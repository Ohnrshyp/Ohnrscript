# ohn-cookie

**Zero-allocation HTTP cookie parser.** Scans cookie headers byte-by-byte, returning pointers (offsets) into the original buffer instead of allocating new strings. This prevents V8 heap fragmentation from string allocations under high-throughput HTTP workloads.

**Target:** V8

---

## Import

```ohnrscript
const cookie = require('ohn-cookie');
```

---

## Types

### `CookiePointer`

```ohnrscript
type CookiePointer = {
  keyStart: number;   // Byte offset where the cookie name begins
  keyEnd: number;     // Byte offset where the cookie name ends (exclusive)
  valStart: number;   // Byte offset where the cookie value begins
  valEnd: number;     // Byte offset where the cookie value ends (exclusive)
};
```

---

## Functions

### `scanCookies(buffer)`

Scans a cookie header buffer and returns an array of `CookiePointer` objects — byte offset pairs that point into the original buffer. No strings are allocated during scanning.

- **Parameters:**
  - `buffer` (`Uint8Array | Buffer`) — The raw `Cookie` header value as bytes
- **Returns:** `CookiePointer[]` — Array of offset pairs for each cookie

```ohnrscript
const headerBuf = Buffer.from('session=abc123; theme=dark; lang=en');
const pointers = cookie.scanCookies(headerBuf);

// pointers[0] → { keyStart: 0, keyEnd: 7, valStart: 8, valEnd: 14 }
// "session" is at bytes [0, 7), "abc123" is at bytes [8, 14)
```

---

### `getCookie(headerBuffer, keyString)`

Extracts a specific cookie value by name. Only allocates a string for the matching cookie's value — all other cookies are scanned by byte offset without allocation.

- **Parameters:**
  - `headerBuffer` (`Uint8Array | Buffer`) — The raw `Cookie` header value
  - `keyString` (`string`) — The cookie name to find
- **Returns:** `string | null` — The cookie value, or `null` if not found

```ohnrscript
const headerBuf = Buffer.from('session=abc123; theme=dark');
const session = cookie.getCookie(headerBuf, 'session');
// → "abc123"

const missing = cookie.getCookie(headerBuf, 'nope');
// → null
```

---

## Design

`getCookie()` is designed for the common case: you have a `Cookie` header with many cookies, but you only need one. Instead of splitting the entire header into strings (which would create garbage for every cookie), it:

1. Scans all cookies by byte offset (zero allocation)
2. Compares key bytes directly against the target key buffer
3. Only allocates a string for the single matching value
