---
date: 2026-10-18
summary: >
  A host can supply the `ShapeCatalog` every data-manager query is built in:
  `DataManagerHost.resolveShapeCatalog()` (optional), loaded once per host object with the same
  backoff as `resolveCatalog`. The default search, create and update then build inside
  `withShapeCatalog(catalog, …)` and register nothing in core's global registry; the query
  functions take `{catalog}` last, and `useHostShapeCatalog()` returns the loaded catalog.
  Released in 2.8.0 (requires `@_linked/core` ^2.35.0). Also added `npm test` (Jest) and made CI run it.
---

# 002 — Queries built in a host-supplied shape catalog

## Why

Without a catalog, the data manager registers each shape it resolves in `@_linked/core`'s
process-wide registry (`registerRuntimeShapes`). That is enough for an app with one set of shapes.
A host that serves several projects, or several branches of one (Create Now's browser), holds the
same shape IRI with different properties at once, and one registry cannot hold both. Core 2.35
added `ShapeCatalog` and `withShapeCatalog` for exactly this; shape-ui now lets the host hand one in.

## Public API (2.8.0)

- `DataManagerHost.resolveShapeCatalog?(): Promise<ShapeCatalog>` (`src/host.ts`). Optional;
  `resolveShape` and `resolveCatalog` stay and keep serving the wires components display from.
- `selectInstances`, `selectInstance` (`src/read.ts`), `searchInstancesWithDsl` (`src/search.ts`),
  `updateInstanceWithDsl` (`src/write.ts`) take `{catalog}` as their last argument;
  `createInstanceWithDsl` takes `catalog` in its existing options object (`{dataRoot, id, catalog}`).
- `useHostShapeCatalog(): ShapeCatalog | undefined` (`src/hostContext.tsx`), for the query
  functions a host calls itself.
- Type `CatalogOptions` exported from the package root.
- `@_linked/core` dependency `^2.35.0`.

## Usage

```ts
import {ShapeCatalog} from '@_linked/core/utils/ShapeCatalog';

const host: DataManagerHost = {
  // ...
  resolveCatalog: async () => wires,
  resolveShapeCatalog: async () => ShapeCatalog.from(wires, {name: `${project}#${branch}`}),
};

// A query the host runs itself:
const catalog = useHostShapeCatalog();
const rows = await selectInstances(shape, {catalog});
```

## Behaviour and decisions

- **Loaded once per host object**, with the backoff `resolveCatalog` already had (2 s doubling to
  60 s, 6 retries, `retry()`). The backoff loader is one generic hook used for both loads. The host
  object is the identity: a host for another scope must be a new object.
- **Wait, never fall back.** A default call made while the catalog loads awaits the same request.
  After a failed load it rejects rather than registering, which would resolve a shape the host did
  not offer. A `resolveShapeCatalog()` that resolves to nothing counts as a failed load.
- **Only the building runs in the scope** (`buildInCatalog`, `src/catalogScope.ts`). The builder
  captures the catalog and core re-enters it when lowering, compiling and live-tracking; `exec()`
  runs outside, as core expects.
- **No catalog, no change.** A host without `resolveShapeCatalog` keeps the registration path
  (the only `registerRuntimeShapes` call left in `hostContext.tsx`).

## Files

| File | Responsibility |
|---|---|
| `src/host.ts` | `resolveShapeCatalog` on the host contract, with its rules |
| `src/catalogScope.ts` | `CatalogOptions`, `buildInCatalog` (build inside `withShapeCatalog` when given) |
| `src/hostContext.tsx` | loads the shape catalog with backoff, passes `{catalog}` to the defaults, `useHostShapeCatalog` |
| `src/read.ts`, `src/search.ts`, `src/write.ts` | query functions accept `{catalog}` |
| `src/index.ts` | exports the hook and the type |
| `README.md` | host contract section, including the catalog |
| `jest.config.cjs`, `package.json` | Jest (ESM, modelled on core's) and the `npm test` script |
| `.github/workflows/pr.yml` | `require-tests: true`, so CI runs `npm test` |

## Tests

- `src/catalog.test.ts` (real core builders): with a catalog, a shape absent from the global
  registry is selected, read by id, searched, created and updated; the dataset receives a query
  that captured the catalog, runs with no catalog active, and compiles to SPARQL with the shape's
  predicates; the shape is still unregistered afterwards. Without a catalog the same shape does not
  resolve.
- `src/hostContext.test.ts` (jsdom): with `resolveShapeCatalog` every default gets `{catalog}`,
  `registerRuntimeShapes` is never called and the catalog is asked for once; a call during the load
  waits; a failed load rejects without registering. Without it, the shape is registered and no
  catalog is passed. The wire catalog still loads, and `retry()` after a failure works.
- `src/search.test.ts`: its `QueryBuilder` mock now exports `QueryBuilder` (core 2.35 imports the
  name); before this the suite had never linked, so it had never run.
- At merge: 7 suites, 73 tests pass; `npx linked build` passes.

## Known limits

- The catalog is per host object, not per call: switching scope means a new host object.

## Follow-ups

- Consumer: Create Now's `CnDataManagerHost` supplies the catalog; recorded in Create Now's plan
  for shape catalogs per project branch (Create Now repo).

## PRs

- https://github.com/linked-fw/shape-ui/pull/66 (released as 2.8.0 in
  https://github.com/linked-fw/shape-ui/pull/67)
