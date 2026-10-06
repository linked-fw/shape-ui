/**
 * Which shape a relation property's values go through — asked in one place.
 *
 * Searching, picking, creating inline and following a link all need the same answer, and
 * each used to read `property.valueShape?.id` for it. That only covers `sh:node`. A
 * relation declared with `sh:class` alone names what its values *are*, not which shape
 * describes them, so those fields had nothing to search, pick or link through.
 *
 * Core's `resolveRelationShape` owns the rule (`sh:node` wins; else the shapes targeting
 * the `sh:class`). What this module adds is WHICH shapes it chooses among: the host's
 * catalog when there is one, because core's registry also holds compiled framework shapes
 * for the same classes. Without a catalog the registry is all there is.
 */

import {useCallback, useMemo} from 'react';
import {
  resolveRelationShape,
  type RelationPropertyLike,
  type RelationShapeResolution,
} from '@_linked/core/shapes/relationShape';
import {useHostCatalog} from '../hostContext.js';

const UNRESOLVED: RelationShapeResolution = {candidates: [], source: 'none'};

/**
 * A resolver bound to the host's catalog, for code that resolves per call — a click
 * handler, a cell renderer — rather than once per field.
 */
export function useRelationShapeResolver(): (
  property: RelationPropertyLike | undefined,
) => RelationShapeResolution {
  const catalog = useHostCatalog();
  return useCallback(
    (property) => (property ? resolveRelationShape(property, catalog) : UNRESOLVED),
    [catalog],
  );
}

/**
 * The shape this relation's values are searched, picked, created and opened through.
 *
 * No `shapeId` means there is no shape to do any of that with: render the value as a
 * reference and offer nothing that needs a shape.
 */
export function useRelationShape(
  property: RelationPropertyLike | undefined,
): RelationShapeResolution {
  const resolve = useRelationShapeResolver();
  return useMemo(() => resolve(property), [resolve, property]);
}
