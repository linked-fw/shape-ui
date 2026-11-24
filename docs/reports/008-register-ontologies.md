---
date: 2026-11-10
summary: >
  `@_linked/shape-ui` compiles against the core that replaced `linkedOntology` with
  `registerOntologies`: the package object gives `registerOntologies`. Node labels compact with
  the app's prefix map. Major.
packages: [shape-ui]
---

# 008 — `registerOntologies` in place of `linkedOntology`

## PR

**What changed.** The core this release builds on removed `linkedOntology` from the package
object (an ontology package registers with `registerOntologies` from a generated
`ontologies/index`) and no package registers a prefix any more; the app loads one prefix map.

- `src/package.ts`: exports `registerOntologies` in place of `linkedOntology`.
- No other change. The one prefix reader, `toPrefixedOrSegment` in `src/shape/nodeDisplay.ts`,
  uses `Prefix.toPrefixedIfPossible` (unchanged API): it now compacts with the app's map and, when
  no prefix matches, falls back to the IRI's last segment as before. The `'xsd:string'`-style
  `ShaclDatatype` values are labels this package never expands.

Major changeset (`.changeset/register-ontologies.md`): `linkedOntology` leaves the public
exports (`@_linked/shape-ui/package`).

**Verification**

`npx linked build`:

```
✔ Checking sideEffects
✔ Checking dependencies
✔ Build successful
```

`npm test`:

```
Test Suites: 9 passed, 9 total
Tests:       84 passed, 84 total
```

**Deviations.** None.

**Follow-ups.** None in this repo; the `@_linked/core` range moves to the new major at release.

## Details

### Phases

1. Inventory: grep of `src` for the removed core API and for code relying on a globally
   registered prefix (`Prefix.*`, prefixed string ids). One compile break (`package.ts`), one
   runtime reader (`nodeDisplay.ts`, display only, tolerant).
2. Fix, build, test (above).

### Decisions

| # | Problem | Choice | Alternative | Rationale |
|---|---|---|---|---|
| 1 | `nodeDisplay` compacts with whatever map is loaded | keep (the app's map) | pass an explicit map | display of the app's own data; the fallback already covers an unknown namespace |
| 2 | changeset level | major | minor | an export is removed |
