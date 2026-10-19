---
'@_linked/shape-ui': patch
---

`DataManagerHostProvider`'s three contexts (the host, its catalog state and its `ShapeCatalog`) are kept in `@_linked/core`'s `sharedState`, so a provider from one copy of shape-ui reaches the hooks of another (`useDataManagerHost` no longer falls back to `nullHost()` silently). Requires `@_linked/core` ^2.36.0.
