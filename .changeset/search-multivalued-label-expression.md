---
"@_linked/shape-ui": patch
---

`searchInstancesWithDsl` searches a multi-valued label (no `maxCount: 1`) again instead of throwing `.some is not a function`: in a `where`, core's accessor for a multi-valued literal is a primitive set, with `.equals()` but no `.some()` or `.contains()`. The filter is now written on the property's values as one expression (`tracedPropertyExpression([label.id]).contains(query)`), which holds when any value contains the query. A single-valued label is unchanged.
