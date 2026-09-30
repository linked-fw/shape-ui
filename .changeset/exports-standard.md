---
'@_linked/shape-ui': patch
---

Every export now resolves to the compiled `lib/esm` output, in every environment. The exports map listed a `development` condition ahead of `import`, pointing at the shipped TypeScript source; Vite enables `development` by default, so a Vite app loaded this package from raw `src/*.ts(x)` in dev — compiled with the app's settings rather than this package's — and from `lib` in its build. `./tokens.css` now points at `lib/esm/tokens.css`, and `.js`-suffixed subpaths resolve via a `./*.js` entry. `src` is still published so a Linked app's dev server can serve the package from source.
