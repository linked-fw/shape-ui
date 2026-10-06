---
'@_linked/shape-ui': minor
---

A relation field now finds the shape its values go through in one place, and a relation declared with `sh:class` alone works. Search, browse, load-more, pick mode, inline create, the overview's node links and the form field all ask `useRelationShape` / `useRelationShapeResolver` (new exports), which use core's `resolveRelationShape`: a declared `sh:node` wins, otherwise the shapes targeting the `sh:class` are candidates. Candidates come from the host's catalog when it supplies `resolveCatalog` — loaded once by `DataManagerHostProvider` and readable with the new `useHostCatalog` — and from core's shape registry otherwise. A relation that resolves to no shape renders its values as plain references, with no picker, search, create or link.

Inline create now asks the host for a form for the **related** shape. It was passed the shape of the form being edited, so "Create New" in a relation field created another instance of the owner and linked that as the value.

Requires `@_linked/core` ^2.26.0 for `@_linked/core/shapes/relationShape`.
