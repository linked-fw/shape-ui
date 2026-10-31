---
date: 2026-10-31
summary: >
  `searchInstancesWithDsl` filtered with `instance[label].contains(query)`, which throws when the
  label property is multi-valued (no `maxCount: 1`, so the accessor is a set). It now uses
  `.some((v) => v.contains(query))` for a multi-valued label and `.contains` for `maxCount: 1`. Patch.
---

# 006 — Search over a multi-valued label

## PR

### Summary

A relation-field search on a shape whose label property has no `maxCount` threw on every dataset
that ran it (core report 097 explains how it surfaced): a multi-valued accessor is a set and has no
`.contains()`.

### Changes

- `src/search.ts`: the form is picked by the label's `maxCount`; `=== 1` keeps `.contains(query)`,
  anything else uses `.some((v) => v.contains(query))` (the same rule as `propertyTypes.ts`).
- `src/search.test.ts`: the builder mock now models a set accessor; tests for a multi-valued and a
  single-valued label assert the query builds and which form is used.

### Verification

- `npm test`: `Test Suites: 9 passed, 9 total`, `Tests: 84 passed, 84 total`
- `npx linked build`: `Build successful`
- CN, `vitest run src/data/CnDataManagerHost.catalog.test.tsx`: `Tests 3 passed (3)`

### Follow-ups

- The package has no live-store tests; the DSL is mocked, so the generated SPARQL for `.some` is
  covered by core's suite only.

## Details

The mock previously returned an object with only `contains`, which is why the bug was invisible to
the suite. `columns.ts` treats `maxCount` null as single-valued for display; search follows the
DSL's accessor type instead, where a missing `maxCount` means a set.
