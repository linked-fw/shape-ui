---
date: 2026-10-24
summary: >
  `propertyTypes` and `DynamicFormField` import `xsd` from the vocabulary package
  (`@_linked/xsd/ontologies/xsd`, namespace import) instead of core's internal
  `@_linked/core/ontologies/xsd`. `@_linked/xsd` ^1.4.1 added as a dependency. Patch.
---

# 005 — xsd from the vocabulary package

## Why

`@_linked/core/ontologies/xsd` is core's internal module. The `xsd` terms are published by the
vocabulary package `@_linked/xsd` as a generated accessor module.

## What changed

- `src/shape/propertyTypes.ts` and `src/components/DynamicFormField.tsx`:
  `import { xsd } from '@_linked/core/ontologies/xsd'` →
  `import * as xsd from '@_linked/xsd/ontologies/xsd'`. Every term they use exists in the
  generated module; they stay accessor references. The `anyURI` checks in the same two files
  compared against the IRI string; they now use `xsd.anyURI.id`.
- `package.json`: `@_linked/xsd` ^1.4.1 in `dependencies`. It depends only on `@_linked/core`,
  so it adds no cycle. It was already installed through `@_linked/schema` (1.4.0); it is now a
  direct dependency and the lockfile moves it to 1.4.1. `npm ls` shows one `@_linked/core@2.42.0`,
  deduped under `@_linked/xsd@1.4.1`.
- `.changeset/core-ontology-imports.md`: patch.
- The `shacl` imports stay on core: no vocabulary package exists for shacl yet.
- A grep of `src`, tests and scripts for `@_linked/core/ontologies/(xsd|rdf|rdfs|owl)`, static
  or dynamic, finds nothing else.

## Gate

- `npx linked build`: "✔ Checking ontology modules", "✔ Build successful".
- `npm test`: "Test Suites: 9 passed, 9 total", "Tests: 82 passed, 82 total".

## PR

### Summary

Property types and `DynamicFormField` take their `xsd` datatypes from the `@_linked/xsd`
vocabulary package instead of core's internal ontology module.

### Changes

- `src/shape/propertyTypes.ts`, `src/components/DynamicFormField.tsx`:
  `import * as xsd from '@_linked/xsd/ontologies/xsd'`; the `anyURI` string comparisons use
  `xsd.anyURI.id`.
- `@_linked/xsd` ^1.4.1 as a direct dependency (it was already installed through
  `@_linked/schema`); lockfile refreshed.
- Patch changeset.

### Verification

- `npx linked build`: "✔ Checking ontology modules", "✔ Build successful".
- `npm test`: "Test Suites: 9 passed, 9 total", "Tests: 82 passed, 82 total".

### Deviations

None.

### Follow-ups

- The `shacl` imports from `@_linked/core/ontologies/shacl` stay until a shacl vocabulary package
  is decided.
