# `@_linked/shape-ui`

UI driven by a shape.

Each component takes a `Shape` and a property shape and renders a control for it — a text
field, a select, a date picker, an avatar. It works on *any* shape, not a known one, which is
the whole point: an application that adds a property gets an editor for it without writing
one.

```tsx
<TextfieldEditor of={person} property={givenName} />
```

## Where it sits

| Layer | Package | Knows about |
|---|---|---|
| Design tokens | `@_linked/css` | nothing |
| Headless components | `@_linked/primitives` | the DOM and the tokens |
| Data binding | `@_linked/react` | shapes and queries; ships no components |
| **Shape-driven UI** | **`@_linked/shape-ui`** | how to render an arbitrary shape |
| Product surfaces | applications | one product's domain vocabulary |

Everything here renders a `@_linked/primitives` control and adds the shape binding. Nothing
here knows about a specific product.

**Consume this layer rather than rebuilding it.** A product that needs a shape-driven form
field extends what is here; growing a second implementation inside an application is how the
same component ends up existing three times, and then drifting.

## The host

The tables, forms and pickers ask a `DataManagerHost` for what depends on the application
around them, supplied once with `<DataManagerHostProvider host={host}>` and read with
`useDataManagerHost()`. A host names no project, branch or dataset: queries are routed by
`LinkedStorage`.

| Member | Required | What it is for |
|---|---|---|
| `resolveShape(iri)` | yes | one shape's wire metadata, for display and for the shape a field or form uses |
| `resolveCatalog()` | no | every shape's wire metadata; `sh:class`-only relations resolve among these |
| `resolveShapeCatalog()` | no | the `ShapeCatalog` every query is built in (below) |
| `dataRoot` | for creates | the base IRI new instances are minted under |
| `searchInstances`, `createInstance`, `updateInstance` | no | filled in from the DSL when absent |
| `readInstance`, `inlineCreate`, `navigate`, `picking` | no | host-specific reads and flows |

**Which shapes a query resolves against.** Without `resolveShapeCatalog`, the default
search, create and update register the shape they resolve in core's global registry
(`registerRuntimeShapes`), which suits an app with one set of shapes. A host that serves
several projects, or several branches of one, returns a `ShapeCatalog` (`@_linked/core`)
for its current scope instead:

```ts
import {ShapeCatalog} from '@_linked/core/utils/ShapeCatalog';

const host: DataManagerHost = {
  dataRoot,
  resolveShape: async (iri) => wires[iri],
  resolveCatalog: async () => wires,
  resolveShapeCatalog: async () => ShapeCatalog.from(wires, {name: `${project}#${branch}`}),
};
```

The provider asks for it once per host object (retrying a rejection with a backoff, like
`resolveCatalog`). Every default then builds its query inside `withShapeCatalog(catalog, …)`
and nothing is registered. A call made while the catalog loads waits for it; after it
failed, the call rejects rather than fall back to the registry. A host for another scope
must be a new object. `useHostShapeCatalog()` returns the loaded catalog, for the query
functions a host calls itself: `selectInstances`, `selectInstance`, `searchInstancesWithDsl`,
`createInstanceWithDsl` and `updateInstanceWithDsl` each take `{catalog}` as their last
argument.

## Tests

```sh
npm test
```

Jest, over `src/**/*.test.ts`; CI runs it on every PR.

## Why the name changed

This package was `@_linked/ui`. That name said only "not backend" — the least informative
label available for the layer most in need of one that states its contract. `shape-ui` says
what it is.
