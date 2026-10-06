import type { NodeShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import { shacl } from '@_linked/core/ontologies/shacl';

/**
 * A dependency link: a child property depends on a parent property.
 * When the parent's value changes, the child should be narrowed or reset.
 */
export interface PropertyDependency {
  /** The parent property label (e.g., "agent") */
  parentLabel: string;
  /** The dependent property label (e.g., "team") */
  childLabel: string;
  /** The shape URI of the parent's valueShape (e.g., Player shape URI) */
  parentValueShapeId: string;
  /** The label of the property on the parent's valueShape that links to the child's valueShape
   *  (e.g., "currentTeam" on the Player shape) */
  linkingPropertyLabel: string;
  /** The full predicate URI of the linking property — needed for SPARQL queries */
  linkingPropertyPath: string;
  /** The shape URI of the child's valueShape (e.g., Team shape URI) */
  childValueShapeId: string;
}

const IRI_NODE_KINDS = new Set([
  shacl.IRI.id,
  shacl.BlankNode.id,
  shacl.BlankNodeOrIRI.id,
]);

/**
 * Only relations with a declared `sh:node` take part. The cascade matches one shape's
 * property against another shape's by shape IRI, which only means something between shapes
 * that were declared; a `sh:class`-only relation resolves to a shape at read time, and
 * chaining guesses on both ends would narrow a field by a link nobody authored.
 */
function isIriProperty(p: NodeShapeWire['propertyShapes'][number]): boolean {
  return !!p.nodeKind && IRI_NODE_KINDS.has(p.nodeKind.id) && !!p.valueShape?.id;
}

/**
 * Compute dependency relationships between IRI properties on a shape.
 *
 * Algorithm: For each pair of IRI properties (A, B) on the same shape,
 * check if A's valueShape has a property whose valueShape matches B's valueShape.
 * If so, B depends on A via that linking property.
 *
 * Only looks 1 level deep and breaks cycles: if A→B and B→A are both found,
 * only the first-discovered direction is kept.
 */
export function computeDependencies(
  shape: NodeShapeWire,
  allShapes: Record<string, NodeShapeWire>
): PropertyDependency[] {
  const candidates: PropertyDependency[] = [];

  const iriProperties = (shape.propertyShapes || []).filter(isIriProperty);

  for (const propA of iriProperties) {
    // Look up the full shape definition for A's valueShape
    const aValueShape = allShapes[propA.valueShape!.id];
    if (!aValueShape?.propertyShapes) continue;

    for (const propB of iriProperties) {
      if (propA.label === propB.label) continue;
      if (!propB.valueShape?.id) continue;

      // Check if A's valueShape has a property pointing to B's valueShape
      for (const linkProp of aValueShape.propertyShapes) {
        if (linkProp.valueShape?.id === propB.valueShape!.id) {
          const pathObj = Array.isArray(linkProp.path)
            ? linkProp.path[0]
            : linkProp.path;
          candidates.push({
            parentLabel: propA.label,
            childLabel: propB.label,
            parentValueShapeId: propA.valueShape!.id,
            linkingPropertyLabel: linkProp.label,
            linkingPropertyPath: pathObj?.id || '',
            childValueShapeId: propB.valueShape!.id,
          });
          break; // Only one linking path per A→B pair
        }
      }
    }
  }

  // Break cycles: if A→B and B→A both exist, keep only the first one found.
  // Also ensure no field ends up as a child of ALL other fields (deadlock).
  return removeCycles(candidates);
}

/**
 * Remove circular dependencies from the candidate list.
 * When A→B and B→A both exist, keep only the first direction found.
 * Then ensure no field is blocked by all other fields (prune so at least
 * one field per connected component has no parents).
 */
function removeCycles(deps: PropertyDependency[]): PropertyDependency[] {
  const kept: PropertyDependency[] = [];
  const edges = new Set<string>(); // "parent->child" strings

  for (const dep of deps) {
    const forward = `${dep.parentLabel}->${dep.childLabel}`;
    const reverse = `${dep.childLabel}->${dep.parentLabel}`;

    // If the reverse direction is already kept, skip this one
    if (edges.has(reverse)) continue;

    edges.add(forward);
    kept.push(dep);
  }

  // Ensure at least one root (a field with no parents) exists.
  // If every field is someone's child, remove the dependency that has the
  // most children as parent (it's the most "primary" field).
  const allChildren = new Set(kept.map((d) => d.childLabel));
  const allParents = new Set(kept.map((d) => d.parentLabel));
  const roots = [...allParents].filter((p) => !allChildren.has(p));

  if (roots.length === 0 && kept.length > 0) {
    // No root — every field is a child. Break the cycle by finding the
    // field that is a child the fewest times and removing its parent deps.
    const childCount = new Map<string, number>();
    for (const d of kept) {
      childCount.set(d.childLabel, (childCount.get(d.childLabel) || 0) + 1);
    }
    // Pick the field that appears as parent most often to be the root
    const parentCount = new Map<string, number>();
    for (const d of kept) {
      parentCount.set(d.parentLabel, (parentCount.get(d.parentLabel) || 0) + 1);
    }
    let bestRoot = '';
    let bestCount = -1;
    for (const [label, count] of parentCount) {
      if (count > bestCount) {
        bestCount = count;
        bestRoot = label;
      }
    }
    // Remove all deps where bestRoot is a child
    return kept.filter((d) => d.childLabel !== bestRoot);
  }

  return kept;
}

/**
 * Build a lookup map: childLabel → PropertyDependency[]
 * A child can depend on multiple parents (rare but possible).
 */
export function buildDependencyMap(
  deps: PropertyDependency[]
): Map<string, PropertyDependency[]> {
  const map = new Map<string, PropertyDependency[]>();
  for (const dep of deps) {
    const existing = map.get(dep.childLabel) || [];
    existing.push(dep);
    map.set(dep.childLabel, existing);
  }
  return map;
}

/**
 * Extract the IDs that a child field should be narrowed to,
 * based on the parent instance data and the linking property.
 */
export function extractNarrowingIds(
  instanceData: Record<string, any>,
  linkingPropertyLabel: string
): string[] {
  const linkedValue = instanceData[linkingPropertyLabel];
  if (!linkedValue) return [];

  if (Array.isArray(linkedValue)) {
    return linkedValue
      .map((v) => (typeof v === 'object' ? v.id : v))
      .filter(Boolean);
  }

  if (typeof linkedValue === 'object' && linkedValue.id) {
    return [linkedValue.id];
  }

  if (typeof linkedValue === 'string') {
    return [linkedValue];
  }

  return [];
}
