---
date: 2026-10-24
summary: >
  The CMS forms mark inherited fields: a property shape the host's wire marks
  `inheritedFrom: {id}` shows "from <Shape>" under its label and after its name in the
  "Add optional field" menu. `inheritedFromName(property, shapes)` is exported. Also: the
  `IDataset` test double implements the methods core 2.39 requires (core backlog 063), and
  `@_linked/core` is raised to ^2.39.3. Released as a minor.
---

# 003 — Inherited fields are marked in the forms

## Why

Create Now stores a shape as declared (its own property shapes plus `core:isExtending`) and its
catalog read appends each shape's inherited property shapes, marking every one with
`inheritedFrom: {id}`, the shape that declares it (Create Now report 118). The forms showed those
fields exactly like the shape's own, so a person editing a `Task` could not tell that `owner`
belongs to `Action`.

## Public API

- `inheritedFromId(property)` and `inheritedFromName(property, shapes?)`
  (`src/shape/inheritance.ts`, exported from the barrel), with the type
  `InheritablePropertyShapeWire`. Core's `PropertyShapeWire` does not declare `inheritedFrom`; it
  is read as an optional extension, and a wire without it renders as before.
- `DynamicForm` takes an optional `inheritedFrom` (the name to show).

## Behaviour and decisions

- **Mark each field, do not group.** Fields keep the order and visibility rules they had; an
  inherited one carries a quiet italic "from Action" under its label (auxiliary text colour, small
  size, as the dependency hint). The "Add optional field"
  menu shows "Owner · from Action"; the item's `textValue` stays the field name, so typeahead is
  unchanged.
- **The name.** The shape's `label` in `allShapes` when the form has it, else the last segment of
  the IRI, both through `formatShapeLabel` (`BaseAction` → `Base Action`). A mark without a string
  `id` is ignored.
- **The host decides what is inherited.** shape-ui does not resolve `core:isExtending` itself; it
  shows what the wire says.

## Files

| File | Responsibility |
|---|---|
| `src/shape/inheritance.ts` | reads the mark, names the source shape |
| `src/components/DynamicFormField.tsx`, `.module.css` | the marker under the label |
| `src/components/AddInstanceForms.tsx`, `EditInstanceForms.tsx`, `forms.module.css` | pass the name; the menu marker |
| `src/catalog.test.ts` | the `IDataset` double implements every required method |
| `src/hostContext.copies.test.ts` | its host literal gains the required `resolveShape` |
| `jest.config.cjs` | `.test.tsx` suites; stylesheet imports map to a class-name stub |
| `package.json`, `package-lock.json` | `@_linked/core` ^2.39.3 |

## Tests

- `src/components/inheritedFrom.test.tsx` (`react-dom/server`): `inheritedFromName` by label, by
  IRI fallback (`BaseAction` → "Base Action"), and undefined for an own field or a malformed mark; `AddInstanceForms` and
  `EditInstanceForms` render "from Action" for the inherited field only, with and without
  `allShapes`.
- At merge, in a scratch copy installed from npm (core 2.39.3): 9 suites, 82 tests pass;
  `tsc --noEmit -p tsconfig-esm.json` passes; `npx linked build` passes.
- `hostContext.copies.test.ts` failed its typecheck on `main` (its host lacked the required
  `resolveShape`), so it had not run locally. Fixed, it passes in the scratch copy. Run in the CN
  workspace against the localized core, it hits a Jest ESM module-cache error ("Module cache
  already has entry …/_linked-core/lib/esm/shapes/nodeShapeData.js") from
  `isolateModulesAsync` re-evaluating core; that is the workspace's linked core, not this change.

## Known limits

- The menu marker is not covered by a test: the Radix menu renders its items only when open, and
  the suite renders static markup.

## Follow-ups

- Create Now takes the release through its lockfile (Renovate); its `^2.8.1` range already admits
  it. Create Now backlog 131 is closed with this.

## PRs

- https://github.com/linked-fw/shape-ui/pull/74
- https://github.com/linked-fw/core/pull/383 (closes core backlog 063)

## PR

**What changed**

- The CMS forms mark inherited fields. A property shape the host's wire marks
  `inheritedFrom: {id}` shows a quiet "from Action" under its label (`AddInstanceForms`,
  `EditInstanceForms`, via `DynamicForm`) and "Owner · from Action" in the "Add optional field"
  menu. New `src/shape/inheritance.ts`: `inheritedFromId`, `inheritedFromName`,
  `InheritablePropertyShapeWire` (exported). Create Now backlog 131.
- Core backlog 063: the `IDataset` double in `src/catalog.test.ts` implements every required
  method, without the `as unknown as IDataset` cast; `deleteQuery` rejects, `graphQuery` throws
  `unsupportedGraphQuery`. `@_linked/core` ^2.36.0 → ^2.39.3, lockfile refreshed in a scratch copy.
- `hostContext.copies.test.ts`: its host gains the required `resolveShape` (it failed typecheck).
- Jest runs `.test.tsx` suites and stubs stylesheet imports. Minor changeset.

**Verification** (scratch copy installed from npm, core 2.39.3)

```
Test Suites: 9 passed, 9 total
Tests:       82 passed, 82 total
tsc --noEmit -p tsconfig-esm.json  → exit 0
npx linked build                   → ✔ Build successful
```

**Deviations:** none from the brief. The review's medium findings: the uncommitted changeset (it
was committed in the next commit) and `hostContext.copies.test.ts` not running in the CN
workspace (pre-existing, described under Tests). Lows taken: the fallback test uses an IRI that
differs from the label, the redundant `title` is gone, the changeset wording.

**Follow-ups:** Create Now takes 2.9.0 through its lockfile (its `^2.8.1` range admits it); the
menu marker has no test (closed Radix content does not render statically), recorded under Known
limits.
