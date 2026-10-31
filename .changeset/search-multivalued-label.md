---
"@_linked/shape-ui": patch
---

`searchInstancesWithDsl` no longer throws when the label property is multi-valued (no `maxCount: 1`): it filters with `.some((v) => v.contains(query))` instead of `.contains(query)` on the set.
