---
'@_linked/shape-ui': patch
---

Build the per-datatype value editors and the shape-domain types into `lib/`.

Ten component modules and `shape/types.ts` were never emitted, because the
build only compiles what an entry transitively reaches and none of them was
exported from `index.ts`. They resolved fine in development — where the export
condition points at `src` — and were missing from every production build.

Now exported from the package root, and reachable by direct path as intended:

```ts
import {SelectEditor} from '@_linked/shape-ui';
import {SelectEditor} from '@_linked/shape-ui/components/SelectEditor';
export * from '@_linked/shape-ui/shape/types';
```

New from the root: `CheckboxEditor`, `RadioButtonEditor`, `SelectEditor`,
`SwitchEditor`, `TextareaEditor`, `ToggleEditor`, `AvatarEditor`, `DateEditor`,
`TextfieldEditor`, and everything in `shape/types` (`DATATYPE_MAP`,
`CURRENT_SHAPE_DRAFT_VERSION`, `isObjectPropertyShape`,
`isDatatypePropertyShape`, and the builder/SHACL types).

`ImageValueEditor` is deliberately still not exported: it has never compiled
and is written against a core API that has moved on, so it needs porting.
