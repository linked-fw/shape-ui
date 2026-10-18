/**
 * Creating and updating instances, through the Linked Query DSL.
 *
 * The counterpart of `search.ts`, and the last piece of the read/write pair that still
 * went through a control-plane RPC. `Project.createShapeInstance(projectId, …)` needed a
 * project id for three things, none of which require one on the client:
 *
 *   - finding the shape          → the host already resolved the catalog
 *   - minting the new IRI        → `host.dataRoot`, a plain value the host supplies
 *   - recording a projection edit → a Create Now studio concern, not a write concern
 *
 * So the write names no project either, and `LinkedStorage` routes it exactly as it routes
 * the read: `AppDataRouter` inside Create Now, the app's own dataset in a standalone or
 * Capacitor build. That matters beyond tidiness — a read that routes one way and a write
 * that routes another is how a form silently saves into the wrong dataset.
 */

import {CreateBuilder} from '@_linked/core/queries/CreateBuilder';
import {UpdateBuilder} from '@_linked/core/queries/UpdateBuilder';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import {buildInCatalog, type CatalogOptions} from './catalogScope.js';

/** A form's values, keyed by property label. */
export type InstanceValues = Record<string, unknown>;

/**
 * Strip a value down to what the graph should hold.
 *
 * A relation field carries `{id, label}` — the label is there so a draft can show a name
 * without re-reading the instance. It is display state, not a fact about the node, and
 * writing it would put a second, immediately stale copy of the label in the graph.
 */
function toGraphValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGraphValue);
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return {id: (value as {id: unknown}).id};
  }
  return value;
}

/** Labels the shape actually declares. Anything else is a stale form field. */
function knownLabels(shape: NodeShapeWire): Set<string> {
  return new Set(
    (shape.propertyShapes ?? []).map((p) => p.label).filter(Boolean) as string[],
  );
}

/**
 * Mint an IRI for a new instance.
 *
 * `dataRoot` is the one value in this path the host has to supply: Create Now takes it
 * from the project's config, a standalone app knows its own domain. Without it there is
 * no namespace to mint into, so this throws rather than inventing one — a node created
 * under a guessed IRI is worse than a failed create.
 */
export function mintInstanceIri(shape: NodeShapeWire, dataRoot?: string): string {
  if (!dataRoot) {
    throw new Error(
      'Cannot create an instance without `dataRoot`: there is no namespace to mint the ' +
        'IRI into. Supply it from the host.',
    );
  }
  const segment = (shape.label || 'instance').toLowerCase();
  const base = dataRoot.replace(/\/+$/, '');
  return `${base}/${segment}/${crypto.randomUUID()}`;
}

/**
 * Create one instance and return its IRI.
 *
 * Empty values are dropped rather than written: on a create there is nothing to clear, and
 * an empty literal is a real triple with an empty string in it.
 */
export async function createInstanceWithDsl(
  shape: NodeShapeWire,
  values: InstanceValues,
  options: {dataRoot?: string; id?: string} & CatalogOptions = {},
): Promise<{id: string}> {
  const known = knownLabels(shape);
  const data: Record<string, unknown> = {};
  for (const [label, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    if (!known.has(label)) continue;
    data[label] = toGraphValue(value);
  }

  const id = options.id ?? mintInstanceIri(shape, options.dataRoot);
  const builder = buildInCatalog(options, () =>
    (CreateBuilder.from(shape.id) as any).withId(id).set(data),
  );
  await builder.exec();
  return {id};
}

/**
 * Update one instance.
 *
 * Empty becomes `null`, which is how the DSL clears a property — the opposite of create,
 * where the same value is dropped. Both are right: clearing a field the viewer emptied is
 * the whole point of an edit form, and there is nothing to clear on a node that does not
 * exist yet.
 *
 * A payload with nothing recognisable in it is a no-op rather than an empty mutation.
 */
export async function updateInstanceWithDsl(
  shape: NodeShapeWire,
  instanceId: string,
  values: InstanceValues,
  options?: CatalogOptions,
): Promise<void> {
  const known = knownLabels(shape);
  const data: Record<string, unknown> = {};
  for (const [label, value] of Object.entries(values)) {
    if (!known.has(label)) continue;
    data[label] = value === '' || value === undefined ? null : toGraphValue(value);
  }
  if (Object.keys(data).length === 0) return;
  const builder = buildInCatalog(options, () =>
    (UpdateBuilder.from(shape.id) as any).for(instanceId).set(data),
  );
  await builder.exec();
}
