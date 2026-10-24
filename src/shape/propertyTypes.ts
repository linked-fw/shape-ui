import type { PropertyShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import { shacl } from '@_linked/core/ontologies/shacl';
import * as xsd from '@_linked/xsd/ontologies/xsd';

/**
 * Classifies a SHACL property shape into a UI-level type.
 * Used by form fields (DynamicFormField) and table filter widgets
 * to determine the appropriate input control and filter operators.
 */
export type PropertyUiType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'url'
  | 'iri-single'
  | 'iri-multi'
  | 'enum-literal'
  | 'enum-iri';

export function getPropertyUiType(property: PropertyShapeWire): PropertyUiType | null {
  const nodeKind = property.nodeKind;
  if (!nodeKind) return null;

  // Enum: sh:in with values present.
  //
  // `sh:in`, the metamodel spelling. The DTO's `inValues` is still read for a host that
  // hands one over, but nothing in this package produces it any more.
  // (was: accepts BOTH forms. The DTO calls it `inValues` — `{id, label}` pairs with a derived
  // display label); the metamodel calls it `in` and keeps members as members. The table
  // now receives the metamodel form, and keying only on `inValues` silently downgraded
  // every enum column to a free-text filter and a free-text batch-edit input.
  const enumValues =
    ((property as {inValues?: unknown[]}).inValues) ??
    ((property as unknown as {in?: unknown[]}).in);
  if (enumValues && enumValues.length > 0) {
    if (nodeKind.id === shacl.Literal.id) return 'enum-literal';
    return 'enum-iri';
  }

  // Object / IRI properties
  if (
    nodeKind.id === shacl.IRI.id ||
    nodeKind.id === shacl.BlankNode.id ||
    nodeKind.id === shacl.BlankNodeOrIRI.id
  ) {
    return property.maxCount === 1 ? 'iri-single' : 'iri-multi';
  }

  // Literal properties — classify by datatype
  if (nodeKind.id === shacl.Literal.id) {
    const dt = property.datatype?.id;
    if (!dt) return 'text';

    if (dt === xsd.boolean.id) return 'boolean';

    if (dt === xsd.date.id) return 'date';

    if (dt === xsd.dateTime.id) return 'datetime';

    if (
      dt === xsd.integer.id ||
      dt === xsd.long?.id ||
      dt === xsd.decimal?.id ||
      dt === xsd.float?.id ||
      dt === xsd.double?.id
    ) {
      return 'number';
    }

    if (dt === xsd.anyURI.id) return 'url';

    return 'text';
  }

  return 'text';
}

/**
 * Returns whether a property UI type represents an integer (vs floating point).
 */
export function isIntegerType(property: PropertyShapeWire): boolean {
  const dt = property.datatype?.id;
  return dt === xsd.integer.id || dt === xsd.long?.id;
}
