/**
 * CSS modules, for the compiler.
 *
 * `linked build` only COPIES these into `lib`; the class-name hashing and scoping is
 * the consuming bundler's job, as in `@_linked/primitives`. A consumer therefore needs a
 * bundler that understands CSS modules — which any app rendering these components already has.
 *
 * The binding is called `styles`, not `classes`, on purpose. `@_linked/primitives` declares the
 * same ambient module, and inside this workspace its *source* is symlinked, so both
 * declarations are visible and `const classes` in each is a duplicate identifier. Ambient
 * module declarations merge; the names inside them must not collide. Renaming is the whole fix.
 *
 * The declaration cannot simply be dropped either: primitives' version reaches us only through
 * the workspace symlink, so a clean `npm ci` in CI has no declaration at all and every
 * `import style from './X.module.css'` fails.
 */
declare module '*.module.css' {
  const styles: {readonly [key: string]: string};
  export default styles;
}
