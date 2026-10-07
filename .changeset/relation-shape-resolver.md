---
'@_linked/shape-ui': minor
---

Relation fields now support relations declared with `sh:class` alone. Every part of a relation field resolves its shape in the same way: search, browse, load more, pick mode, inline create, links in the overview and in `InstanceView`, and the form field.

New exports from `@_linked/shape-ui`:

- `useRelationShape(property)`: the shape a relation's values are searched, picked, created and opened through. It returns core's `RelationShapeResolution` (`{shapeId?, candidates, source}`).
- `useRelationShapeResolver()`: the same lookup as a function, for click handlers and cell renderers.
- `useHostCatalog()`: the host's catalog as a list once it has loaded, otherwise `undefined`.
- `useHostCatalogState()`: one of `none`, `loading`, `loaded` (with `shapes`) or `failed` (with `retry()`). It is exported with the `HostCatalogState` type.
- `useHostCatalogLoading()`: true while the host's catalog is loading.

```tsx
import {useRelationShape, useHostCatalogState} from '@_linked/shape-ui';

function RelationTarget({property}) {
  const {shapeId} = useRelationShape(property);
  const catalog = useHostCatalogState();
  if (shapeId) return <span>{shapeId}</span>;
  if (catalog.status === 'failed') return <button onClick={catalog.retry}>Retry</button>;
  return <span>{catalog.status === 'loading' ? '…' : 'No shape'}</span>;
}
```

The rule comes from core's `resolveRelationShape`: a declared `sh:node` wins, and otherwise the least specific shapes that target the `sh:class` are the candidates. When the host supplies `resolveCatalog`, `DataManagerHostProvider` loads the catalog once and the candidates come from it. Core's shape registry is used only when the host has no `resolveCatalog`.

Behaviour changes:

- While the host's catalog is loading, or after it failed, a `sh:class`-only relation resolves to no shape. It does not fall back to a registry shape the host never offered.
- A rejected `resolveCatalog()` is now logged and retried with a backoff (2s, doubling, capped at 60s) up to 6 times. After that it stays `failed` until `retry()` is called. The `failed` state is one stable object, so retries do not re-render the components that read it.
- A relation that resolves to no shape shows its values as plain, read-only references. It has no picker, search, create or link, and shows `…` while the catalog is loading. A related node's badge in `InstanceOverview` and `InstanceView` is clickable only when its relation resolves to a shape.
- Every relation check now uses core's `isRelation`, so a property that has only `sh:nodeKind sh:IRI` is a relation. It renders through the relation field. With no shape it is read-only in forms, and it is no longer shown in the `cell` display context.
- An `sh:in` dropdown on a relation now writes the chosen member as a reference (`{id}`) rather than a string, and field validation expects a reference. A `sh:class`-only `sh:in` property no longer fails validation on save.
- Fix: inline create ("Create New" in a relation field) now asks the host for a form for the related shape. Before, it was given the shape of the form being edited, so it created another instance of the owner and linked that as the value.

Requires `@_linked/core` ^2.26.0.
