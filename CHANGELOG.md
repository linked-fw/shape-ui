# @\_linked/ui

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
