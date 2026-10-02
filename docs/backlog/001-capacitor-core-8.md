---
summary: >
  `@capacitor/core` 5 -> 8 is deferred: we decided not to upgrade Capacitor for now. It is a
  devDependency here, but `src/utils/helper.ts` imports `Capacitor` at runtime (used by
  `ImageValueEditor` to rewrite `localhost` image URLs on Android in dev), so the published code
  needs a package it does not declare to consumers. Fix the declaration, or remove the one call,
  before upgrading.
status: Deferred -- held by the shared Renovate preset; replaces Renovate PR linked-fw/shape-ui#36
---

# 001 — `@capacitor/core` 8 is deferred

**Status:** deferred. We decided not to upgrade Capacitor for now. Renovate PR
[#36](https://github.com/linked-fw/shape-ui/pull/36) (`@capacitor/core` to v8) is superseded by
this note, and majors of `@capacitor/**` are disabled in
[`linked-fw/renovate-config`](https://github.com/linked-fw/renovate-config). Remove that rule
when this is picked up.

## How it is used here

- Declared in **`devDependencies`** as `^5.3.0` -- and not in `peerDependencies`.
- One runtime import: `src/utils/helper.ts` imports `{ Capacitor }` and calls
  `Capacitor.getPlatform() === 'android'` in `replaceLocalhostWithSiteRoot`, which
  `src/components/ImageValueEditor.tsx` uses. Outside production it swaps `http://localhost:<port>`
  for `SITE_ROOT` so an Android emulator can load the image.
- That import ships in `lib/`. A consumer that does not happen to have `@capacitor/core`
  installed gets an unresolved import as soon as `ImageValueEditor` is loaded. The declaration
  is wrong independently of the version.

## What changes between 5 and 8

`Capacitor.getPlatform()` is unchanged across 6, 7 and 8, so the code here needs no edit. The cost
of 8 lands on the apps (shape-ui only builds against it as a dev dep):

| | Node | Xcode | iOS min | Android min / target SDK | Other |
|---|---|---|---|---|---|
| **6** | 18+ | 15+ | 13 | 22 / 34 | `addListener` returns only a Promise; Android scheme defaults to `https` |
| **7** | 20+ | 16+ | 14 | 23 / 35 | JDK 21; `bundledWebRuntime` removed |
| **8** | 22+ | 26+ | 15 | 24 / 36 | AGP 8.13, Gradle 8.14.3, Kotlin 2.2.20; `adjustMarginsForEdgeToEdge` removed; iOS SPM by default |

Sources: <https://capacitorjs.com/docs/updating/6-0>, `/7-0`, `/8-0`.

## Recommendation

The dependency is used, so it cannot simply be deleted. Two options, both better than upgrading
the devDependency on its own:

- **Drop it:** replace the `Capacitor.getPlatform()` check with a check that needs no native
  package (e.g. `window.Capacitor?.getPlatform?.()`, which Capacitor injects on native), then
  remove `@capacitor/core` from `devDependencies`. A dev-only image-URL workaround should not tie
  a UI package to a native runtime.
- **Or declare it honestly:** add `@capacitor/core` to `peerDependencies` with a wide range
  (`>=5`) and mark it optional in `peerDependenciesMeta`.

Not done here.

## When this is picked up

1. Choose one of the options above; either one makes the Capacitor major irrelevant to this
   package.
2. Check `ImageValueEditor` on an Android emulator against a dev server still loads images.
3. The `@capacitor/**` major hold in `renovate-config` also covers `auth` and `server-utils`;
   lift it only once those are resolved.
