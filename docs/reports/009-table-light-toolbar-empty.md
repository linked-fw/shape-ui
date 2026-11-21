---
date: 2026-11-21
summary: >
  `ReactTable`: the toolbar (action bar) and the sticky Actions column are on the table's light
  surface instead of the grey `--surface-bg`; an empty dataset shows a short "No <shape> yet."
  message instead of a header row with select-all and Actions, and "Page 1 of 0"; the page label
  counts at least one page. Patch.
---

# 009 — A light table toolbar and an empty table

## PR

### Summary

A host app's owner found the instance table's toolbar on a dark grey panel, and an empty table
(a shape with no instances) showing a header row with select-all, an "ACTIONS" header and
"Page 1 of 0" with its pagination buttons.

### Changes

- `src/components/ReactTable.module.css`: `.tableWrapper` (whose background the toolbar shows) uses
  `var(--table-header-bg, var(--surface-bg))`, light and dark, so the toolbar, the header row and
  the pagination are one surface set apart by borders; the sticky Actions cells use
  `--table-row-bg` (its header `--table-header-bg`) instead of `--surface-bg`. New `.emptyMessage`.
- `src/components/ReactTable.tsx`: with the whole dataset empty (`totalCount`, else `data`, is 0)
  and not loading, the table renders "No <shape label> yet." instead of the header row, the rows
  and the pagination; the toolbar (with its New button) stays. The page label uses
  `Math.max(1, pageCount)`.
- `src/components/ReactTable.test.tsx` (new): the empty dataset (client-side and `totalCount: 0`)
  shows the message and no `<thead>`, Actions or page label; loading still shows the table; with
  rows the label reads "Page 1 of 1".

### Verification

- `npm test`: `Test Suites: 10 passed, 10 total`, `Tests: 88 passed, 88 total`
- `npx linked build`: `Build successful`
- In a host app, light and dark: the toolbar is white (light) / the row colour (dark), the Actions
  column matches its rows.

### Follow-ups

- A host that wants a richer empty state (an icon, a line of help, its own button) renders it
  itself when the dataset is empty, as the host app that found this does; a slot for it in
  `ReactTable` is not needed yet.
