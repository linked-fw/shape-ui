---
date: 2026-11-02
summary: >
  Comments and backlog no longer name the private app shape-ui was extracted from; they say "a
  host app". No behaviour change, no changeset.
packages: [shape-ui]
---

# 007 — No host-app mentions

## PR

**What changed.** The private host app's name, its package names (`@create-now/data-manager`,
`create-now-js`), its router class and its architecture-doc reference are gone from `src/`
(`ReactTable.tsx`, `index.ts`, `search.ts`, `shape/contracts.ts`, `shape/inheritance.ts`,
`shape/types.ts`, `tokens.css`, `write.ts`) and from `docs/backlog/001`. Comments now say "a host
app" or "a host's data router". **Verification:** `npx linked build` (`✔ Build successful`),
`npm test` (`Test Suites: 9 passed, 9 total`, `Tests: 84 passed, 84 total`). **Deviations:** none.
**Follow-ups:** none.

## Details

Comments only; no identifier, string or export changed.
