---
'@_linked/shape-ui': minor
---

`InstanceOverview` and `ReactTable` accept an optional `totalCount`, so a host that fetches one page at a time can paginate server-side: the table switches to manual pagination and derives its page count and controls from the full dataset size. Omitting `totalCount` keeps today's client-side pagination unchanged. `src/index.ts` also imports `./package.js` again, restoring the house pattern now that the live-binding bug behind "Class extends value undefined" is fixed in `@_linked/core` 2.18.1.
