---
'@_linked/shape-ui': minor
---

Depend on `@_linked/react@^2.0.0` (was `^1.5.3`), `@_linked/schema@^1.5.0` (was `^1.0`, the first schema release on `@_linked/react` 2) and `@_linked/core@^2.27.0` (was `^2.26.0`, the core peer range `@_linked/react` 2 requires). The `@_linked/primitives` dev dependency moves to `^1.8.0` so the build runs against the primitives release on react 2.

An app on `@_linked/react` 2 no longer installs a second copy of `@_linked/react` 1 through this package or through schema. The only thing used from it is `cl`, which 2.0 did not change.

The `@_linked/primitives` peer range stays `^1.2.0`: narrowing it would be a breaking change for apps that pin an older primitives. Apps on `@_linked/react` 2 should use `@_linked/primitives@^1.8.0`.

Minor rather than major: `@_linked/react` is a regular dependency here, not a peer, so no consumer has to change anything to install this release.
