---
"@_linked/shape-ui": patch
---

`ReactTable`: the toolbar and the sticky Actions column take the table's light surface (`--table-header-bg` / `--table-row-bg`) instead of the grey `--surface-bg`; an empty dataset shows "No <shape> yet." in place of the header row, select-all, Actions column and pagination; the page label never reads "of 0".
