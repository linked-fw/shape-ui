/**
 * The table model: a shape in, ordered and filtered columns out.
 *
 * Pure and framework-free on purpose. Which columns a table shows, in what order, and
 * which one carries the label is the part worth testing and the part that has to behave
 * identically wherever the table renders. Keeping it out of the React layer means it can
 * be exercised directly, and means a different renderer (a mobile list, a picker, a
 * printed view) makes the same decisions.
 *
 * The rule throughout: **what the shape declares beats what the renderer guesses.**
 * `core:displayRank` orders, `core:displayHidden` removes, `sh:order`
 * breaks ties. The heuristics apply only where a shape declares nothing — which, until
 * the display vocabulary existed, was everywhere.
 */

import type {
  NodeShapeWire,
  PropertyShapeWire,
} from '@_linked/core/shapes/nodeShapeWire';

/**
 * Whether the table shows the columns it judges useful, or every column.
 *
 * Lives here rather than in a page. `InstanceOverview` and `ReactTable` both imported this
 * type from `pages/InstanceOverviewPage` — organisms depending on a page, which is exactly
 * backwards and would have blocked moving either of them.
 */
export type TableMode = 'auto' | 'full';

/** How much room the caller has. A table shows more than a card; a cell shows one. */
export type DisplayContext = 'cell' | 'card' | 'table' | 'full';

const CONTEXT_LIMITS: Record<DisplayContext, number> = {
  cell: 1,
  card: 3,
  table: 6,
  full: Number.POSITIVE_INFINITY,
};

/** Predicates that conventionally carry a human label, best first. */
const LABEL_PREDICATES = [
  'http://www.w3.org/2000/01/rdf-schema#label',
  'http://www.w3.org/2004/02/skos/core#prefLabel',
  'http://schema.org/name',
  'http://purl.org/dc/terms/title',
  'http://purl.org/dc/elements/1.1/title',
  'http://xmlns.com/foaf/0.1/name',
];

/** Names that read as an identity rather than an attribute. */
const NAMEY = /(name|label|title|identifier|handle|slug|heading|caption)/i;

/** Datatypes whose values are too long to sit in a table cell. */
const LONG_TEXT = new Set([
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#HTML',
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#XMLLiteral',
]);

export interface Column {
  /** The property this column reads. */
  property: PropertyShapeWire;
  /** The key a row object is expected to carry — the property's label. */
  key: string;
  /** What to put in the header. */
  header: string;
  /** True for the column that best identifies the row. */
  isLabel: boolean;
}

/** The predicate IRI of a simple path, or undefined for a complex one. */
function predicateOf(property: PropertyShapeWire): string | undefined {
  const path = property.path as unknown;
  if (typeof path === 'string') return path;
  if (path && typeof path === 'object' && 'id' in (path as {id?: string})) {
    return (path as {id: string}).id;
  }
  return undefined; // sequence / alternative / inverse — not a single predicate
}

function localName(iri: string): string {
  const cut = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return cut >= 0 ? iri.slice(cut + 1) : iri;
}

/**
 * Whether a property can be shown at a given context.
 *
 * What fits depends on how much room there is, and an earlier version of this got that
 * wrong: it applied the narrowest rule everywhere, so wiring it into a table silently
 * deleted every relation, multi-valued and long-text column. A cell really can only hold
 * one short scalar. A table can hold a badge for a related node, and a row of them.
 */
function fitsContext(
  property: PropertyShapeWire,
  context: DisplayContext,
): boolean {
  const isRelation = !!(property.valueShape || property.class);
  const isMultiValued = property.maxCount != null && property.maxCount !== 1;
  const isLongText = !!property.datatype && LONG_TEXT.has(property.datatype.id);

  switch (context) {
    case 'cell':
      // One value, rendered inline. A relation would need a badge and a long text would
      // need truncation; neither belongs in a cell that stands in for the whole instance.
      return !isRelation && !isMultiValued && !isLongText;
    case 'card':
      // Room for a few values including a related node, but still not a wall of text.
      return !isLongText;
    case 'table':
      // A table renders relations as badges and multi-values as a row of them. Long text
      // is the one thing that breaks a row's height.
      return !isLongText;
    case 'full':
      // A detail view shows everything the shape does not hide.
      return true;
  }
}

/**
 * Sort key for an undeclared value. A finite sentinel rather than `Infinity`, because
 * `Infinity - Infinity` is `NaN` and a comparator that returns NaN is undefined by spec —
 * it happened to behave because V8 reads NaN as "equal".
 */
const UNDECLARED = Number.MAX_SAFE_INTEGER;

const declaredRank = (p: PropertyShapeWire): number => p.displayRank ?? UNDECLARED;
const declaredOrder = (p: PropertyShapeWire): number => p.order ?? UNDECLARED;

/** Declared precedence: rank, then `sh:order`. Undeclared properties sort last. */
function byDeclared(a: PropertyShapeWire, b: PropertyShapeWire): number {
  return declaredRank(a) - declaredRank(b) || declaredOrder(a) - declaredOrder(b);
}

/**
 * Heuristic score, used only where nothing is declared. Higher is more important.
 *
 * These weights are a guess dressed as a number, and they exist so a shape that says
 * nothing still renders sensibly. A shape that declares `displayRank` never reaches here.
 */
function score(property: PropertyShapeWire): number {
  let s = 0;
  if ((property.minCount ?? 0) > 0) s += 100;
  const name = `${property.label ?? ''} ${localName(predicateOf(property) ?? '')}`;
  if (NAMEY.test(name)) s += 50;
  if (/(type|description|date|email|url)/i.test(name)) s += 25;
  if (property.datatype) s += 10;
  return s;
}

/**
 * Properties the shape does not hide, and that fit the given context.
 *
 * `displayHidden` is checked first and applies to every context: it is a statement about
 * the property, not about how much room there is.
 */
export function displayableProperties(
  shape: NodeShapeWire,
  context: DisplayContext = 'table',
): PropertyShapeWire[] {
  return (shape.propertyShapes ?? []).filter(
    (p) => p.displayHidden !== true && !!p.label && fitsContext(p, context),
  );
}

/** True when any property on the shape declares a rank. */
export function hasDeclaredRanks(shape: NodeShapeWire): boolean {
  return (shape.propertyShapes ?? []).some((p) => p.displayRank != null);
}

/**
 * The property that best identifies an instance of this shape.
 *
 * Declared rank first; then a conventional label predicate; then a name-ish literal.
 * Undefined when the shape has nothing showable — the caller falls back to the IRI, which
 * is a display decision and not this function's to make.
 */
export function labelProperty(
  shape: NodeShapeWire,
  context: DisplayContext = 'cell',
): PropertyShapeWire | undefined {
  // The label stands in for the whole instance, so it is held to the CELL rule even when
  // the surrounding table is wider — a relation or a blob does not identify a row.
  const candidates = displayableProperties(shape, context);
  if (candidates.length === 0) return undefined;

  if (hasDeclaredRanks(shape)) {
    const ranked = candidates
      .filter((p) => p.displayRank != null)
      .sort(byDeclared);
    if (ranked.length) return ranked[0];
  }

  for (const predicate of LABEL_PREDICATES) {
    const match = candidates.find((p) => predicateOf(p) === predicate);
    if (match) return match;
  }

  return candidates.find((p) =>
    NAMEY.test(`${p.label} ${localName(predicateOf(p) ?? '')}`),
  );
}

/**
 * Columns for a shape at a given context, label first.
 *
 * `limit` overrides the context's own limit for a caller that knows its space better.
 */
export function columnsFor(
  shape: NodeShapeWire,
  context: DisplayContext = 'table',
  limit?: number,
): Column[] {
  const label = labelProperty(shape);
  const declared = hasDeclaredRanks(shape);

  const rest = displayableProperties(shape, context).filter((p) => p !== label);
  rest.sort(declared ? byDeclared : (a, b) => score(b) - score(a));

  const ordered = label ? [label, ...rest] : rest;
  const max = limit ?? CONTEXT_LIMITS[context];

  return ordered.slice(0, max).map((property) => ({
    property,
    key: property.label,
    header: property.name || property.label,
    isLabel: property === label,
  }));
}
