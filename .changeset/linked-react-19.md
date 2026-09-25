---
'@_linked/shape-ui': minor
---

Require `@_linked/react` ^1.5.3, so the package installs under React 19.

The range was `^1.4`, and the lockfile held 1.4.2 — whose only React peer is
`^18.2.0`. Against this package's React 19 devDependency that is unresolvable,
so installs needed `--legacy-peer-deps`. `@_linked/react` 1.5.0 widened its peer
to `^18.2.0 || ^19.0.0`; raising the floor to ^1.5.3 lets the tree resolve with
plain `npm install`. Minor rather than patch: it raises the minimum version of a
runtime dependency for consumers.
