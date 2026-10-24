---
date: 2026-10-24
summary: >
  `@_linked/schema` raised to ^1.8.0 (generated accessor modules) and `@_linked/core` to ^2.41.0.
  Shape UI imports only schema's shapes and `ImageUploader`, so no source changed. Patch.
---

# 004 — schema with generated accessor modules

## Why

`@_linked/schema` 1.8 replaces the aggregated `schema` object with a generated namespace module
(`import * as schema from '@_linked/schema/ontologies/schema'`). Shape UI's range should name the
release it is tested against.

## What changed

- `package.json`: `@_linked/schema` ^1.5.0 → ^1.8.0, `@_linked/core` ^2.39.3 → ^2.41.0 (schema
  1.8 requires it), `@_linked/cli` (dev) ^1.45.5 → ^1.57.0; lockfile refreshed.
- No source change. The grep for the old object imports and the renamed terms finds nothing:
  `ImageValueEditor` imports `@_linked/schema/shapes/Thing`, `shapes/ImageObject` and
  `components/ImageUploader`, whose exports did not change. `shacl` and `xsd` come from core's
  internal `@_linked/core/ontologies/*`, which stays.

## Gate

- `npx linked build`: "✔ Build successful".
- `npm test`: "Tests: 82 passed, 82 total".
- `npm ls`: `@_linked/schema@1.8.0` with `@_linked/xsd@1.4.0`.

## PR

### Summary

Raises shape-ui's `@_linked/schema` range to the release with generated accessor modules.

### Changes

- `@_linked/schema` ^1.8.0, `@_linked/core` ^2.41.0, `@_linked/cli` (dev) ^1.57.0; lockfile
  refreshed.
- No source change: shape-ui imports only schema's shapes and `ImageUploader`, whose exports are
  unchanged.

### Verification

- `npx linked build`: "✔ Build successful".
- `npm test`: "Tests: 82 passed, 82 total".

### Deviations

None.

### Follow-ups

None.
