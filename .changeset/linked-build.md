---
"@_linked/shape-ui": patch
---

Drops the `@capacitor/core` dev dependency. Its only use was `replaceLocalhostWithSiteRoot` in `utils/helper`, which nothing called; the function is removed, so the published `lib/` no longer imports a package it never declared.

The `build` script is now `linked build`, the same build CI and the release workflow already run, so a local build produces the published `lib/` (compiled output, copied `src` assets and rewritten ESM import specifiers). The `build-esm` and `copy-to-lib` scripts and the `rimraf`/`copyfiles` dev dependencies are removed.
