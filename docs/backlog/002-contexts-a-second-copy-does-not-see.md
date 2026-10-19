---
summary: >
  `HostContext`, `CatalogContext` and `ShapeCatalogContext` are created at module level, so a
  provider from one copy of shape-ui is invisible to hooks from another; `useDataManagerHost` then
  falls back to `nullHost()` silently. Create the contexts inside core's `sharedState`.
packages: [shape-ui]
---

# 002 — Contexts a second copy does not see

A module can be evaluated twice in one runtime (Vite's SSR runner and Node under `linked start`, or two browser bundles). The convention ([shared state and error brands](https://github.com/linked-fw/cli/blob/main/docs/architecture/shared-state-and-error-brands.md)) keeps caller-set module state on `globalThis` with `sharedState(pkg, name, init)` from `@_linked/core` 2.36.0, React contexts in that shared state, and brands error classes with `brandLinkedError` so consumers match them with `isLinkedError`. Each fix needs a test that loads a second copy of the module (`jest.isolateModulesAsync`, or a `?copy` query on the built file) and shows the state is shared.

Found by the survey for linked-fw/cli backlog 017.

| File | Context | Symptom with two copies |
|---|---|---|
| `src/hostContext.tsx:34` | `HostContext` (`DataManagerHostProvider` / `useDataManagerHost`) | Falls back to `nullHost()`: the data manager renders with no host and no error. |
| `src/hostContext.tsx:62` | `CatalogContext` | Catalog loading state missing. |
| `src/hostContext.tsx:75` | `ShapeCatalogContext` | Shape catalog handle missing; queries use the global registry. |

Fix: `const {HostContext, CatalogContext, ShapeCatalogContext} = sharedState('@_linked/shape-ui',
'contexts', () => ({...createContext calls...}))`. Safe per copy: `src/shape/tableFilters.ts:191`
`filterCounter` (ids also carry `Date.now()`).
