---
summary: >
  The data manager edits owned (`contains`) properties like any other, but clearing or replacing
  an owned value deletes the old owned node and everything it owns. Mark owned fields in forms and
  tables and warn before a clear or a replace removes the old value's node.
packages: [shape-ui]
---

# 001 — Mark owned fields and warn before an owned value is replaced

Source: Create Now plan 068 phase 3 (its report 098, review round 1). Create Now now keeps a
project shape's ownership (`contains`, `dependent`) as the app declares it, in the browser and on
the backend, so a data-manager write cascades exactly as the app's own write does.

## The gap

`@_linked/core` lowers a replace, unset or set-remove of an owned value into a delete of the old
node and its owned subtree (core `docs/architecture/owned-values.md`). The edit form and the
instance table show an owned property as an ordinary field: nothing tells the person that
clearing it, or picking another value, deletes the node it held.

## Wanted

- Owned fields (a property shape with `contains`) carry a visible marker in forms, tables and the
  view page.
- Clearing or replacing an owned value asks first, naming what goes (the old node; with the host's
  help, its owned subtree).
- An owned field never offers "link an existing node" (hosts refuse it already; the picker
  should not offer it).
