/**
 * Searching for instances of a shape, through the Linked Query DSL.
 *
 * This is the **default** implementation the host gets for free. Without it,
 * `searchInstances` was an optional host method, so a relation field rendered an empty
 * picker until someone wrote a search by hand — which made "works in a standalone app"
 * true of the table and false of every relation field.
 *
 * It names no project. `SelectBuilder.from(shapeIri)` is routed by `LinkedStorage` exactly
 * like the table read: `AppDataRouter` inside Create Now, the app's own default dataset in
 * a standalone build.
 *
 * The label comes from `labelProperty()` — the same rule the table uses for its label
 * column, so a row and a picker chip cannot disagree about what identifies an instance.
 * Create Now's `Project.searchInstances` RPC computed a label server-side with its own
 * rule; two mechanisms for one question is how the `getShapeInstances` divergence started.
 */

import {SelectBuilder} from '@_linked/core/queries/QueryBuilder';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import {buildInCatalog, type CatalogOptions} from './catalogScope.js';
import {labelProperty} from './columns.js';
import type {InstanceSuggestion, SearchInstancesOptions} from './host.js';

/** Case-insensitive "contains" over the label, or all instances when the query is empty. */
export async function searchInstancesWithDsl(
  shape: NodeShapeWire,
  options: SearchInstancesOptions = {},
  catalogOptions?: CatalogOptions,
): Promise<{results: InstanceSuggestion[]; hasMore: boolean}> {
  const label = labelProperty(shape);
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  // Ask for one more than the caller wants. That is how `hasMore` is answered without a
  // second COUNT query — cheaper, and it cannot disagree with the page it describes.
  const probe = limit + 1;

  const query = options.query?.trim();
  const builder = buildInCatalog(catalogOptions, () => {
    let built = SelectBuilder.from(shape.id).select((instance: any) =>
      label ? [instance[label.label]] : [],
    ) as unknown as {
      where(fn: (i: any) => unknown): unknown;
      limit(n: number): unknown;
      offset(n: number): unknown;
      exec(): Promise<Record<string, unknown>[]>;
    };

    if (query && label) {
      // No label means nothing to match on, so a text query would filter everything out —
      // better to return the unfiltered page than an empty one.
      built = built.where((instance: any) =>
        instance[label.label].contains(query),
      ) as typeof built;
    }

    built = built.limit(probe) as typeof built;
    if (offset) built = built.offset(offset) as typeof built;
    return built;
  });

  const rows = (await builder.exec()) ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    results: page.map((row) => toSuggestion(row, label?.label)),
    hasMore,
  };
}

/**
 * Narrow a result set to specific ids.
 *
 * Applied after the query rather than inside it: `narrowedIds` comes from another field's
 * value and is usually a handful of ids, so filtering in memory avoids building a VALUES
 * clause for a case that rarely has many members. Revisit if that assumption breaks.
 */
export function narrowSuggestions(
  suggestions: InstanceSuggestion[],
  narrowedIds?: string[] | null,
): InstanceSuggestion[] {
  if (!narrowedIds?.length) return suggestions;
  const allowed = new Set(narrowedIds);
  return suggestions.filter((s) => allowed.has(s.id));
}

function toSuggestion(
  row: Record<string, unknown>,
  labelKey?: string,
): InstanceSuggestion {
  const id = String(row.id ?? '');
  const raw = labelKey ? row[labelKey] : undefined;
  return {
    id,
    // Fall back to the IRI rather than an empty chip. A shape with no showable label is a
    // modelling gap, and showing the id at least lets someone recognise the row.
    label: displayValue(raw) ?? id,
  };
}

function displayValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return displayValue(value[0]);
  if (typeof value === 'object') {
    const candidate = value as {label?: unknown; id?: unknown};
    return displayValue(candidate.label) ?? displayValue(candidate.id);
  }
  return undefined;
}
