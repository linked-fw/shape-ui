/**
 * Which shape an inherited property comes from.
 *
 * A host's catalog can list a shape's inherited property shapes next to its own, marking each
 * inherited one with `inheritedFrom: {id}`, the shape that declares it (Create Now does, when it
 * resolves `core:isExtending`). Core's `PropertyShapeWire` does not declare the field, so it is
 * read here as an optional extension: a catalog without it renders every field as the shape's own.
 */
import type {NodeShapeWire, PropertyShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import {formatShapeLabel} from './naming.js';

/** A property shape that may carry the shape it is inherited from. */
export type InheritablePropertyShapeWire = PropertyShapeWire & {inheritedFrom?: {id?: unknown}};

/** The IRI of the shape `property` is inherited from, when the catalog marks it inherited. */
export function inheritedFromId(property: PropertyShapeWire): string | undefined {
  const id = (property as InheritablePropertyShapeWire).inheritedFrom?.id;
  return typeof id === 'string' && id ? id : undefined;
}

/**
 * The name of the shape `property` is inherited from: its label in `shapes` (keyed by IRI), else
 * the last segment of its IRI (split on `/` and `#`, so a hash IRI names its fragment, where
 * `getShapeParamsFromUri` reads only path segments). Undefined for a property the shape declares
 * itself.
 */
export function inheritedFromName(
  property: PropertyShapeWire,
  shapes?: Record<string, NodeShapeWire> | null,
): string | undefined {
  const id = inheritedFromId(property);
  if (!id) return undefined;
  const label = shapes?.[id]?.label || id.split(/[#/]/).filter(Boolean).pop() || id;
  return formatShapeLabel(label);
}
