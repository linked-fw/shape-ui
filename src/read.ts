/**
 * Reading instances of a shape, through the Linked Query DSL.
 *
 * The counterpart of `write.ts`, and the piece a consumer previously had to write themselves:
 * the components took `instances` as a prop, and the only exported read helper was
 * picker-shaped (label only). So a host got the rendering for free and reimplemented the
 * reading — which is how two ideas of "what a row is" appear in one codebase.
 *
 * Names no project. `SelectBuilder.from(shapeIri)` is routed by `LinkedStorage` exactly as the
 * write is: `AppDataRouter` inside a studio, the app's own default dataset in a standalone or
 * Capacitor build. Read and write route as a pair, or a table ends up looking at a different
 * dataset than the form saves into.
 *
 * The projection comes from `columnsFor`, the same rule the table's columns use, so a row can
 * never carry a property the table does not show or miss one it does.
 */

import {SelectBuilder} from '@_linked/core/queries/QueryBuilder';
import type {
  NodeShapeWire,
  PropertyShapeWire,
} from '@_linked/core/shapes/nodeShapeWire';
import {buildInCatalog, type CatalogOptions} from './catalogScope.js';
import {columnsFor, type DisplayContext} from './columns.js';

/**
 * Key each row by the property LABEL, whatever the query returned.
 *
 * The projection asks for `instance[property.label]`, but results come back keyed by the
 * property-shape IRI's local part. For the framework's own IRI scheme —
 * `.../shape/{pkg}/{Shape}/{prop}` — those are the same string, so the mismatch is invisible.
 * For a shape authored in a hash namespace they are not: `…/vocab#Contact/name` has the local
 * part `Contact/name`, and every value lands under a key no caller looks up. The table then
 * renders empty columns with no error, which is the worst way for this to fail.
 *
 * Matching on the last path segment is what makes both schemes agree. Anything already keyed
 * by its label is left alone, so this costs nothing in the common case.
 */
function keyByLabel(
  rows: Record<string, unknown>[],
  properties: PropertyShapeWire[],
): Record<string, unknown>[] {
  const labels = properties.map((p) => p.label).filter(Boolean) as string[];
  if (labels.length === 0) return rows;

  const lastSegment = (key: string) => key.split(/[#/]/).pop() ?? key;

  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    // `id` is not a property; it names the row.
    if ('id' in row) out.id = row.id;
    for (const label of labels) {
      if (label in row) {
        out[label] = row[label];
        continue;
      }
      const match = Object.keys(row).find(
        (key) => key !== 'id' && lastSegment(key) === label,
      );
      if (match) out[label] = row[match];
    }
    return out;
  });
}

export interface InstanceQuery {
  /** Which properties to read. Defaults to the columns for `context`. */
  properties?: PropertyShapeWire[];
  context?: DisplayContext;
  limit?: number;
  offset?: number;
}

export interface InstanceRows {
  rows: Record<string, unknown>[];
  /** The properties actually read, in the order they were asked for. */
  properties: PropertyShapeWire[];
}

/**
 * Instances of one shape.
 *
 * The shape must be in `options.catalog` when one is given, else already registered — call
 * `loadShapeCatalog` first. That is deliberate rather than convenient: registering inside the
 * query would hide a catalog read behind every table refresh.
 */
export async function selectInstances(
  shape: NodeShapeWire,
  query: InstanceQuery = {},
  options?: CatalogOptions,
): Promise<InstanceRows> {
  const properties =
    query.properties ??
    columnsFor(shape, query.context ?? 'table').map((column) => column.property);

  if (properties.length === 0) {
    // Nothing showable. An empty result is the honest answer; a query with no projection
    // would either error or return bare subjects the caller cannot render.
    return {rows: [], properties};
  }

  // `any` on the proxy parameter is the established form for a runtime shape: the shape
  // is not a compiled class, so there is no generated type for the builder to infer from.
  // The property labels are the contract, and they come from the shape itself.
  const builder = buildInCatalog(options, () => {
    let built = SelectBuilder.from(shape.id).select((instance: any) =>
      properties.map((property) => instance[property.label]),
    ) as unknown as {
      limit(n: number): unknown;
      offset(n: number): unknown;
      exec(): Promise<Record<string, unknown>[]>;
    };
    if (query.limit != null) built = built.limit(query.limit) as typeof built;
    if (query.offset != null) built = built.offset(query.offset) as typeof built;
    return built;
  });

  const rows = await builder.exec();
  return {rows: keyByLabel(rows ?? [], properties), properties};
}

/**
 * One instance by id.
 *
 * Same query as {@link selectInstances}, narrowed to a subject — so a detail view and a
 * table cannot disagree about what a property means or how it is read.
 */
export async function selectInstance(
  shape: NodeShapeWire,
  instanceId: string,
  query: InstanceQuery = {},
  options?: CatalogOptions,
): Promise<{row: Record<string, unknown> | null; properties: PropertyShapeWire[]}> {
  const properties =
    query.properties ??
    (shape.propertyShapes ?? []).filter((p) => p.displayHidden !== true && !!p.label);

  if (properties.length === 0) return {row: null, properties};

  const builder = buildInCatalog(options, () =>
    (
      SelectBuilder.from(shape.id).select((instance: any) =>
        properties.map((property) => instance[property.label]),
      ) as unknown as {
        where(fn: (i: any) => unknown): {
          exec(): Promise<Record<string, unknown>[]>;
        };
      }
    ).where((instance: any) => instance.equals({id: instanceId})),
  );
  const rows = (await builder.exec()) as Record<string, unknown>[];

  return {row: keyByLabel(rows ?? [], properties)[0] ?? null, properties};
}
