---
date: 2026-10-19
summary: >
  Backlog 002 done: `HostContext`, `CatalogContext` and `ShapeCatalogContext` are created once per
  runtime inside `@_linked/core`'s `sharedState('@_linked/shape-ui', 'contexts', …)`, so a
  `DataManagerHostProvider` from one copy of shape-ui reaches `useDataManagerHost` and the catalog
  hooks of another copy, instead of the hooks silently getting `nullHost()`. Requires core ^2.36.0.
  A jsdom test renders the provider from one copy and a consumer from a second copy. Patch release.
---

# 001 — Host contexts shared across copies

Replaces backlog 002 ("contexts a second copy does not see"). Follows the convention in linked-fw/cli
[shared state and error brands](https://github.com/linked-fw/cli/blob/main/docs/architecture/shared-state-and-error-brands.md)
§3 (React contexts), filed by the survey in cli report 020.

## Why

A module can be evaluated twice in one runtime: under `linked start` once by Vite's SSR module
runner and once by Node, or in a browser when two bundles each carry a copy (cli report 018 fixed a
dev duplicate that was exactly this module loaded twice). `src/hostContext.tsx` created its three
React contexts at module level, so each copy had its own:

| Context | Read by | Symptom with two copies |
|---|---|---|
| `HostContext` | `useDataManagerHost` | The hook gets the default `nullHost()`: the data manager renders with no host and no error. |
| `CatalogContext` | `useHostCatalogState`, `useHostCatalogLoading`, `useHostCatalog` | Catalog state reads `none`: class-only relations resolve against the global registry. |
| `ShapeCatalogContext` | `useHostShapeCatalog`, `useDataManagerHost`'s defaults | No catalog handle: queries are built against the global registry instead of the host's catalog. |

## What changed

- `src/hostContext.tsx`: the three `createContext` calls moved into one container,
  `sharedState('@_linked/shape-ui', 'contexts', () => ({HostContext, CatalogContext,
  ShapeCatalogContext}))`, which lives on `globalThis[Symbol.for('@_linked/shape-ui:contexts')]`.
  The first copy to load creates the contexts; every later copy reads the same objects. The
  public API (`DataManagerHostProvider` and the hooks) is unchanged.
- `package.json`: `@_linked/core` `^2.35.0` → `^2.36.0` (the first release with `sharedState`);
  the lockfile resolves 2.36.1.
- Changeset `.changeset/shared-host-contexts.md` (patch).

## Decisions

- **One container for all three contexts**, as the convention recommends: one key, and the
  contexts are always used together by `DataManagerHostProvider`.
- **The defaults come from the first copy.** `nullHost()` and the `none` catalog state of the
  copy that loaded first are the defaults every copy sees. Consumers only read `status` and the
  host's fields, so which copy's default object it is makes no difference.
- **One React is still required.** Two Reacts cannot share a context; that is a resolution bug
  (the CLI dedupes React), not something this module works around.
- **The container outlives a version.** A later shape-ui that adds a context to it must fill the
  field in when it finds a container an older copy created without it.
- **Left per copy:** `src/shape/tableFilters.ts` `filterCounter` (ids also carry `Date.now()`), as
  the backlog item found. shape-ui has no other must-share module state.

## Tests

- New `src/hostContext.copies.test.ts` (jsdom): loads a second copy of `hostContext` with
  `jest.isolateModulesAsync`, React pinned to the first copy's with `jest.unstable_mockModule`
  (the isolated registry would otherwise evaluate a second React). It asserts the copies are
  separate evaluations, that a consumer using the second copy's `useDataManagerHost` and
  `useHostCatalogState` inside the first copy's `DataManagerHostProvider` sees the provider's host
  and catalog state, and that the container sits under `Symbol.for('@_linked/shape-ui:contexts')`.
  The isolated registry also loads core twice, which core reports on `console.error`; the test
  drops that one message and passes everything else through.
- Without the fix, the consumer test fails (`Received: undefined` for the host's `dataRoot`).
- Full suite: 8 suites, 76 tests pass; `npx linked build` passes.

## Follow-ups

- The status table in linked-fw/cli `docs/architecture/shared-state-and-error-brands.md` still
  lists shape-ui as "shape-ui backlog 002"; it can say "done" once this release is out (cli repo).
