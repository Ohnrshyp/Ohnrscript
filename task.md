# Phase 1 Checklist

- [x] `ohn-cookie`
- [x] `ohn-uuid`
- [x] `ohn-ws`
- [x] `ohn-cbor`
- [x] `ohn-zod`
  - [x] Migrate zero-allocation Ahead-of-Time validation logic to `packages/ohn-zod/src/ohn-zod.ohn`.
  - [x] Include strict TypeScript specifications for `.d.ts` / IDE autocomplete.
  - [x] Create reputable benchmark comparing `ohn-zod` vs `zod` over millions of iterations.
- [x] `ohn-vector`
  - [x] Move source logic to `packages/ohn-vector/src/ohn-vector.ohn` with native TypeScript types.
  - [x] Move example test scripts into `packages/ohn-vector/tests/`.
  - [x] Ensure everything compiles cleanly.
