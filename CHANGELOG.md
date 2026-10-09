# @\_linked/ui

## 2.6.2

### Patch Changes

- [#52](https://github.com/linked-fw/shape-ui/pull/52) [`3ed0a81`](https://github.com/linked-fw/shape-ui/commit/3ed0a81773a1157efe979faeb04625552306a30e) Thanks [@flyon](https://github.com/flyon)! - The types now admit the empty values these components already handle. `formatShapeLabel` accepts `null` and `undefined` and formats a missing label to `''`; it used to return the falsy input unchanged, which put `undefined` into strings like "New undefined". `InstanceOverview`'s `properties` may be `null` while the shape is loading, which the table already supported; `ReactTable`'s `properties` accepts `null` for the same reason. The node-click handler now tolerates that too. `InstanceView`'s `properties` is optional and nullable, and with none no related node links. `EditInstanceForms` never reads `properties`, so there the prop is optional, nullable and deprecated. Apps compiled with `strictNullChecks` no longer need fallbacks to call any of them.

## 2.6.1

### Patch Changes

- [#56](https://github.com/linked-fw/shape-ui/pull/56) [`c1e4501`](https://github.com/linked-fw/shape-ui/commit/c1e4501041403c0974195211b551d37f4367bd6b) Thanks [@flyon](https://github.com/flyon)! - Publish only the files consumers need; the tarball no longer includes the test files under `src/`.

## 2.6.0

### Minor Changes

- [#53](https://github.com/linked-fw/shape-ui/pull/53) [`819f12a`](https://github.com/linked-fw/shape-ui/commit/819f12a92b794e955b24014fd7caec178eb40953) Thanks [@flyon](https://github.com/flyon)! - Relation fields now support relations declared with `sh:class` alone. Every part of a relation field resolves its shape in the same way: search, browse, load more, pick mode, inline create, links in the overview and in `InstanceView`, and the form field.
  
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

## 2.5.2

### Patch Changes

- [#44](https://github.com/linked-fw/shape-ui/pull/44) [`5e95897`](https://github.com/linked-fw/shape-ui/commit/5e95897596dc01e5e20af74b9b0e64387498c3a4) Thanks [@flyon](https://github.com/flyon)! - Every export now resolves to the compiled `lib/esm` output, in every environment. The exports map listed a `development` condition ahead of `import`, pointing at the shipped TypeScript source; Vite enables `development` by default, so a Vite app loaded this package from raw `src/*.ts(x)` in dev — compiled with the app's settings rather than this package's — and from `lib` in its build. `./tokens.css` now points at `lib/esm/tokens.css`, and `.js`-suffixed subpaths resolve via a `./*.js` entry. `src` is still published so a Linked app's dev server can serve the package from source.

## 2.5.1

### Patch Changes

- [#31](https://github.com/linked-fw/shape-ui/pull/31) [`09569fd`](https://github.com/linked-fw/shape-ui/commit/09569fd5a6e84072683a7141b7ae6e66e5ddee64) Thanks [@flyon](https://github.com/flyon)! - Sourcemaps now embed their TypeScript source, so consumers no longer see 'points to missing source files' warnings.

## 2.5.0

### Minor Changes

- [#28](https://github.com/linked-fw/shape-ui/pull/28) [`c453712`](https://github.com/linked-fw/shape-ui/commit/c453712564a9816c34405af1463ae3c7ee333837) Thanks [@flyon](https://github.com/flyon)! - Require `@_linked/react` ^1.5.3, so the package installs under React 19.

  The range was `^1.4`, and the lockfile held 1.4.2 — whose only React peer is
  `^18.2.0`. Against this package's React 19 devDependency that is unresolvable,
  so installs needed `--legacy-peer-deps`. `@_linked/react` 1.5.0 widened its peer
  to `^18.2.0 || ^19.0.0`; raising the floor to ^1.5.3 lets the tree resolve with
  plain `npm install`. Minor rather than patch: it raises the minimum version of a
  runtime dependency for consumers.

## 2.4.0

### Minor Changes

- [#26](https://github.com/linked-fw/shape-ui/pull/26) [`af82587`](https://github.com/linked-fw/shape-ui/commit/af82587c1c694f7f59d94cb31ba50836b384b05c) Thanks [@flyon](https://github.com/flyon)! - Require `@_linked/core@^2.22.8` (was `^2.18.1`), and pin it in the lockfile.

  The declared range was wide enough that the resolved core depended on whatever the
  consumer — or this repo's own CI, via `package-lock.json` — happened to install. Core
  decides how a shape's IRI is minted, so a stale core made this package emit legacy
  `data.lincd.org` IRIs instead of the arch-02 `linked.cm` scheme. Which IRIs a published
  package produces should not be a function of the installer's dependency tree.

  Minor rather than patch: this raises the minimum core a consumer must resolve, so it
  changes what gets installed rather than only what this package does internally.

## 2.3.5

### Patch Changes

- [#24](https://github.com/linked-fw/shape-ui/pull/24) [`6cf4617`](https://github.com/linked-fw/shape-ui/commit/6cf46178a3a0059364a4ae9e5a723cd53090ac63) Thanks [@flyon](https://github.com/flyon)! - Point the changelog generator at this repo's real org.

  `.changeset/config.json` still named `linked-cm/shape-ui` as the GitHub repo,
  but this package lives in `linked-fw/shape-ui`. Every commit, PR and author
  link that `@changesets/changelog-github` wrote into `CHANGELOG.md` therefore
  pointed at a repository that does not exist. Renaming the org makes the
  generated links resolve.

## 2.3.4

### Patch Changes

- [#22](https://github.com/linked-fw/shape-ui/pull/22) [`28a2ddf`](https://github.com/linked-fw/shape-ui/commit/28a2ddf89bcca79f23fb49e8667f965f55d43db8) Thanks [@flyon](https://github.com/flyon)! - Give this package its own linked identity.

  `src/package.ts` re-exported `@_linked/core`'s decorators verbatim, so any
  shape declared here would register under the package name `@_linked/core` and
  carry a `.../shape/core/...` IRI. A third name — a cosmetic
  `packageName: '@_linked/ui'` literal — matched neither the npm name nor the
  registration.

  Nothing is decorated here today, so nothing was mis-registered. The point is
  the next shape added: `Server.call` routes on the package name a shape carries,
  so one naming the wrong package is simply unreachable.

## 2.3.3

### Patch Changes

- [#20](https://github.com/linked-fw/shape-ui/pull/20) [`fc1c0d0`](https://github.com/linked-fw/shape-ui/commit/fc1c0d0ca1bdb7ae311ce6a04ba4a34d9438ca6d) Thanks [@flyon](https://github.com/flyon)! - Compile the whole `src` folder, and let a bare import resolve under Node10.

  The build only emitted what an entry transitively reached, so any module
  nothing imported was never built — and never type-checked, so it rotted
  quietly. `include` now covers `src/**/*` with tests excluded explicitly.

  `typesVersions` maps every specifier through `lib/esm/*`, so a `types` value
  that already carried that prefix had it applied twice and no consumer on
  classic Node10 resolution could `import` the package by its bare name.

## 2.3.2

### Patch Changes

- [#18](https://github.com/linked-fw/shape-ui/pull/18) [`9a90a89`](https://github.com/linked-fw/shape-ui/commit/9a90a89ebf94a02c1f80780d02996314daa9ae8d) Thanks [@flyon](https://github.com/flyon)! - Build the per-datatype value editors and the shape-domain types into `lib/`.

  Ten component modules and `shape/types.ts` were never emitted, because the
  build only compiles what an entry transitively reaches and none of them was
  exported from `index.ts`. They resolved fine in development — where the export
  condition points at `src` — and were missing from every production build.

  Now exported from the package root, and reachable by direct path as intended:

  ```ts
  import { SelectEditor } from "@_linked/shape-ui";
  import { SelectEditor } from "@_linked/shape-ui/components/SelectEditor";
  export * from "@_linked/shape-ui/shape/types";
  ```

  New from the root: `CheckboxEditor`, `RadioButtonEditor`, `SelectEditor`,
  `SwitchEditor`, `TextareaEditor`, `ToggleEditor`, `AvatarEditor`, `DateEditor`,
  `TextfieldEditor`, and everything in `shape/types` (`DATATYPE_MAP`,
  `CURRENT_SHAPE_DRAFT_VERSION`, `isObjectPropertyShape`,
  `isDatatypePropertyShape`, and the builder/SHACL types).

  `ImageValueEditor` is deliberately still not exported: it has never compiled
  and is written against a core API that has moved on, so it needs porting.

## 2.3.1

### Patch Changes

- [#16](https://github.com/linked-fw/shape-ui/pull/16) [`c03e001`](https://github.com/linked-fw/shape-ui/commit/c03e00177b953332ecf5f8fcabb9744f1aecd0e7) Thanks [@flyon](https://github.com/flyon)! - Declare npm as the package manager for this repo, convert the build scripts off `yarn`, and mark `package-lock.json` as a generated file.

## 2.3.0

### Minor Changes

- [#13](https://github.com/linked-fw/shape-ui/pull/13) [`f1df38d`](https://github.com/linked-fw/shape-ui/commit/f1df38d5472528e0dbc089fe23695f6630abe9a6) Thanks [@flyon](https://github.com/flyon)! - `InstanceOverview` and `ReactTable` accept an optional `totalCount`, so a host that fetches one page at a time can paginate server-side: the table switches to manual pagination and derives its page count and controls from the full dataset size. Omitting `totalCount` keeps today's client-side pagination unchanged. `src/index.ts` also imports `./package.js` again, restoring the house pattern now that the live-binding bug behind "Class extends value undefined" is fixed in `@_linked/core` 2.18.1.

## 2.2.0

### Minor Changes

- [#11](https://github.com/linked-cm/shape-ui/pull/11) [`979e444`](https://github.com/linked-cm/shape-ui/commit/979e4442504ed6118a2e3b258a8fbc3b91b580ac) Thanks [@flyon](https://github.com/flyon)! - Absorb the shape-driven CRUD surfaces from `@create-now/data-manager`.

  The editors here render one control for one property. What was missing was everything you build
  out of them: a table over any shape's instances, a form derived from its property list, a
  read-only view, a relation picker, and the shape domain underneath — column derivation,
  property visibility, validation, and the read and write paths through the Linked Query DSL.

  Those lived in a private package on the assumption that shape-driven CRUD was a product. It is
  not. It renders any shape, knows nothing about projects, and is worth nothing without shapes to
  render — the product is the studio that authors them. Keeping it private also meant a second
  package in this exact layer, which is how `@_linked/ui` came to be bypassed in the first place:
  it was built for this job, then an application grew its own form field, value editor and
  relation picker rather than extending it.

  Also fixes the editors' binding types. They declared `of: Shape` and `property: PropertyShape`
  — live instances — while reading `property.label` and `property.in`, which exist on the
  metamodel and not on those classes. That was 24 type errors, invisible because the build script
  ended in `|| echo`, so a failing `tsc` still published. The build now fails on a type error, and
  the types say what the code has always done: plain data keyed by property label.

## 2.0.0

### Major Changes

- [#7](https://github.com/linked-cm/ui/pull/7) [`be0c4ef`](https://github.com/linked-cm/ui/commit/be0c4ef095d30cd1388517f7d13383eb26b4926c) Thanks [@flyon](https://github.com/flyon)! - Rename from `@_linked/ui` to `@_linked/shape-ui`.

  `ui` said only "not backend", which is the least informative name available for the layer
  most in need of one that states its contract. Every component here takes a shape and a
  property shape and renders a control for it, working on any shape rather than a known one.
  `shape-ui` says that.

  Renaming now because it is nearly free: the package has three consumers. It becomes
  expensive as soon as it has more, and this layer should have more.

  Also removes nine compiled CommonJS files that had been committed into `src/` alongside their
  `.tsx` sources, and a dead `ShapeTable.tsx.old`.

## 1.0.3

### Patch Changes

- [#3](https://github.com/linked-cm/ui/pull/3) [`24d8c4b`](https://github.com/linked-cm/ui/commit/24d8c4bdd0e97d01dacdda8dcc94b17cfad84ca8) Thanks [@flyon](https://github.com/flyon)! - loadData: ESM-only JSON import — drop the dead CJS branch, add the `{ with: { type: 'json' } }` import attribute.

## 1.0.2

### Patch Changes

- [`56ee32e`](https://github.com/linked-cm/ui/commit/56ee32ef1e709b8b6841870c53a73e285c68b6c7) - Initial release under the new publishing setup.
