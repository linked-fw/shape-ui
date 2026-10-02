---
"@_linked/shape-ui": minor
---

Move the instance table to `@tanstack/react-table` 9.

- `ReactTableProps.columns` is now typed as `ShapeTableColumnDef[]` — react-table 9's
  `ColumnDef<ShapeTableFeatures, TData>`. `ShapeTableColumnDef`, `ShapeTableFeatures` and the
  `shapeTableFeatures` registry are exported. Column definitions written for react-table 8
  (`id`, `header`, `cell`, `accessorFn`, `accessorKey`) still work at runtime; code that types
  them with react-table 8's `ColumnDef<T>` needs the new type.
- Clicking a text column header now always sorts case-insensitively and orders embedded numbers
  naturally ("item2" before "item10"). Under react-table 8 that only happened when the table held
  more than ten rows — it sampled rows 11 onwards to detect a column's type, so smaller tables
  fell back to a plain case-sensitive comparison.
- Pagination, server-side pagination with `totalCount`, and row selection behave as before.
