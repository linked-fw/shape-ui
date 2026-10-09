---
'@_linked/shape-ui': patch
---

The types now admit the empty values these components already handle. `formatShapeLabel` accepts `null` and `undefined` and formats a missing label to `''`; it used to return the falsy input unchanged, which put `undefined` into strings like "New undefined". `InstanceOverview`'s `properties` may be `null` while the shape is loading, which the table already supported; `ReactTable`'s `properties` accepts `null` for the same reason. The node-click handler now tolerates that too. `InstanceView`'s `properties` is optional and nullable, and with none no related node links. `EditInstanceForms` never reads `properties`, so there the prop is optional, nullable and deprecated. Apps compiled with `strictNullChecks` no longer need fallbacks to call any of them.
