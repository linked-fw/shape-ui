---
date: 2026-11-11
summary: >
  Report 006's fix filtered a multi-valued label with `.some((v) => v.contains(query))`, which
  core's primitive sets do not have, so the search still threw (`.some is not a function`) on
  every dataset. The filter is now one expression over the property's values. Patch.
---

# 007 — Search over a multi-valued label, against core's real builder

## PR

### Summary

A relation-field search on a shape whose label property has no `maxCount: 1` still threw:
`TypeError: instance[label.label].some is not a function`. Report 006 replaced `.contains` on the
set with `.some(...)`, but in a `where` a multi-valued literal is a `QueryPrimitiveSet`, which has
`.equals()` (some value equals), `size()`, `min()` and `max()`, and no `.some()` and no string
methods. `.some()` exists only on a multi-valued relation (`QueryShapeSet`). The suite did not see
it because the builder is mocked, and the mock gave the set a `.some()`.

### Changes

- `src/search.ts`: a multi-valued label is filtered with
  `tracedPropertyExpression([label.id]).contains(query)`. This is the expression over the
  property's values that core itself builds for a primitive set's `min()` / `max()`, and a filter on
  it holds when any value contains the query. A single-valued label keeps `.contains(query)`.
- `src/search.dsl.test.ts` (new): the search with core's real builder against a host catalog, the
  query lowered to SPARQL as a store lowers it. A multi-valued label is searched, and the `CONTAINS`
  filter is on the variable the label's own triple binds. The control: a single-valued label is
  searched the same way, and an empty query adds no filter. Against the code before this change the
  multi-valued case fails with the error above.
- `src/search.test.ts`: the mock no longer gives a set `.some()`. The multi-valued case asserts a
  filter is applied without going through the accessor; its meaning is covered by the new test.

### Verification

- `npm test`: `Test Suites: 10 passed, 10 total`, `Tests: 86 passed, 86 total`.
- `npx tsc -p tsconfig.json --noEmit`: no errors.
- `npx linked build`: `Build successful`.
- In a host app on `@_linked/core` 2.48, with the built `search.js` in place, the search sends
  `"where": ["CONTAINS", {"@path": "title"}, "a"]` for a multi-valued `title` and no longer throws.

### Follow-ups

- Core could give `QueryPrimitiveSet` the string methods with "some value" meaning, as its
  `.equals()` already has. Then a caller could write `instance[label].contains(query)` for any label
  and this branch could go.
- `CONTAINS` is case-sensitive, while the function's doc says case-insensitive. That was true before
  this change too; making it case-insensitive is a behaviour change of its own.
