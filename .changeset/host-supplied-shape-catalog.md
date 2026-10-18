---
'@_linked/shape-ui': minor
---

A host can supply the shapes every query is built against: `DataManagerHost.resolveShapeCatalog()` returns a `ShapeCatalog` (`@_linked/core` 2.35). `DataManagerHostProvider` loads it once per host object, with the same retry as `resolveCatalog`, and the default search, create and update build their queries inside `withShapeCatalog(catalog, …)` and register nothing in core's global registry. A call made while the catalog loads waits for it; after a failed load it rejects instead of falling back to registration. `selectInstances`, `selectInstance`, `searchInstancesWithDsl`, `createInstanceWithDsl` and `updateInstanceWithDsl` take `{catalog}` as their last argument (for the create, in its existing options), and `useHostShapeCatalog()` returns the loaded catalog. A host without `resolveShapeCatalog` keeps today's registration. Requires `@_linked/core` ^2.35.0. The package now has an `npm test` script, and CI runs it.
