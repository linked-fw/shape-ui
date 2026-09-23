---
'@_linked/shape-ui': patch
---

Give this package its own linked identity.

`src/package.ts` re-exported `@_linked/core`'s decorators verbatim, so any
shape declared here would register under the package name `@_linked/core` and
carry a `.../shape/core/...` IRI. A third name — a cosmetic
`packageName: '@_linked/ui'` literal — matched neither the npm name nor the
registration.

Nothing is decorated here today, so nothing was mis-registered. The point is
the next shape added: `Server.call` routes on the package name a shape carries,
so one naming the wrong package is simply unreachable.
