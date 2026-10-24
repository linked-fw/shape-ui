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
  size, as the dependency hint), with the title "Inherited from Action". The "Add optional field"
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
  IRI fallback, and undefined for an own field or a malformed mark; `AddInstanceForms` and
  `EditInstanceForms` render "from Action" for the inherited field only, with and without
  `allShapes`.
- At merge, in a scratch copy installed from npm (core 2.39.3): 9 suites, 82 tests pass;
  `tsc --noEmit -p tsconfig-esm.json` passes; `npx linked build` passes.
- Run in the workspace against the localized core, `hostContext.copies.test.ts` hits a Jest ESM
  module-cache error ("Module cache already has entry …/_linked-core/lib/esm/…"); it passes
  against the installed core and in CI.

## Known limits

- The menu marker is not covered by a test: the Radix menu renders its items only when open, and
  the suite renders static markup.

## Follow-ups

- Create Now takes the release through its lockfile (Renovate); its `^2.8.1` range already admits
  it. Create Now backlog 131 is closed with this.

## PRs

- https://github.com/linked-fw/shape-ui/pull/TBD
