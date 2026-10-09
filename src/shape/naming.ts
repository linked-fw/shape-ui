/**
 * Turning a shape IRI or a label into something a person can read.
 *
 * Pure string work over the Linked shape-IRI scheme (arch-02), with no knowledge of any
 * application: the same IRI produces the same short form wherever it is rendered. These live
 * here because a table header, a form label and a breadcrumb must not each have their own idea
 * of how `ActionPlan` is written out.
 */

/**
 * Format a shape or property label for display.
 *
 * `actionPlan` → `Action Plan`, and `HTMLParser` → `HTML Parser` — the second rule exists
 * because the naive lowercase-to-uppercase split turns an acronym into `H T M L Parser`.
 * Already-spaced and lowercase-only strings pass through unharmed. A missing label formats to
 * `''`, so a caller can interpolate the result without leaking `undefined` into the UI.
 */
export function formatShapeLabel(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * The short form of a shape IRI: `{packageSlug}:{ShapeName}`.
 *
 * Current scheme (arch-02): `https://linked.cm/shape/{slug}/{ShapeName}`.
 * Legacy scheme: `https://data.lincd.org/module/{slug}/shape/{name}` — still read, because
 * shapes materialized under the old scheme are still in stores.
 *
 * Falls back to the last two path segments rather than throwing. A shape from neither scheme
 * still needs *a* short form, and a wrong-looking label is far better than a page that fails
 * to render because one IRI was unusual.
 */
export function getShapeParamsFromUri(nodeShapeURI: string): string {
  const linkedMatch = nodeShapeURI.match(/\/shape\/([^/]+)\/([^/]+)$/);
  if (linkedMatch) return `${linkedMatch[1]}:${linkedMatch[2]}`;

  const legacyMatch = nodeShapeURI.match(/module\/(.*?)\/shape\/([^/]+)$/);
  if (legacyMatch) return `${legacyMatch[1]}:${legacyMatch[2]}`;

  const parts = nodeShapeURI.split('/');
  return `${parts[parts.length - 2]}:${parts[parts.length - 1]}`;
}

/** The display name from a short form: `irl:ActionPlan` → `Action Plan`. */
export function getShapeNameFromParams(str: string): string {
  const lastWord = str.split(':').pop() ?? str;
  return formatShapeLabel(lastWord.charAt(0).toUpperCase() + lastWord.slice(1));
}
