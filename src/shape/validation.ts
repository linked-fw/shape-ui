import {enumOptions} from './nodeDisplay.js';
import type { PropertyShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import { shacl } from '@_linked/core/ontologies/shacl';
import { isRelation } from '@_linked/core/shapes/relationShape';

export interface FieldError {
  propertyLabel: string;
  message: string;
}

/**
 * Validate a single field value against its PropertyShape constraints.
 * Returns an error message string, or empty string if valid.
 */
export function validateField(
  property: PropertyShapeWire,
  value: any,
): string {
  const nodeKind = property.nodeKind?.id;
  // Node-valued by the same rule core's validation uses: a node kind other than literal,
  // or a `sh:node` / `sh:class` — whose values are references (`{id}`), not strings.
  const isIRI = isRelation(property);

  // Required check (minCount > 0)
  if (property.minCount > 0) {
    if (isIRI) {
      // For IRI properties, value is an object or array of objects
      const isEmpty =
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0);
      if (isEmpty) return 'At least one selection is required';
    } else {
      if (value === undefined || value === null || value === '') {
        return 'This field is required';
      }
    }
  }

  // Skip further validation if value is empty (optional fields)
  if (value === undefined || value === null || value === '') return '';

  // sh:in — value must be in the allowed set
  const choices = enumOptions(property);
  if (choices.length > 0) {
    if (isIRI) {
      const selected = Array.isArray(value) ? value : [value];
      const allowedIds = new Set(choices.map((v) => v.id));
      const invalid = selected.find((s) => !allowedIds.has(s.id));
      if (invalid) return 'Must be one of the allowed values';
    } else {
      const allowedIds = new Set(choices.map((v) => v.id));
      if (!allowedIds.has(String(value))) {
        return 'Must be one of the allowed values';
      }
    }
  }

  // Literal-only constraints
  if (nodeKind === shacl.Literal.id) {
    const strVal = typeof value === 'string' ? value : String(value);

    // sh:pattern
    if (property.pattern) {
      try {
        const re = new RegExp(property.pattern);
        if (!re.test(strVal)) return 'Value must match the required format';
      } catch {
        // Invalid regex in shape definition — skip
      }
    }

    // sh:minLength
    if (property.minLength != null && strVal.length < property.minLength) {
      return `Must be at least ${property.minLength} characters`;
    }

    // sh:maxLength
    if (property.maxLength != null && strVal.length > property.maxLength) {
      return `Must be at most ${property.maxLength} characters`;
    }

    // Numeric range constraints
    const numVal = typeof value === 'number' ? value : parseFloat(strVal);
    if (!isNaN(numVal)) {
      if (property.minInclusive != null && numVal < Number(property.minInclusive)) {
        return `Must be at least ${property.minInclusive}`;
      }
      if (property.maxInclusive != null && numVal > Number(property.maxInclusive)) {
        return `Must be at most ${property.maxInclusive}`;
      }
      if (property.minExclusive != null && numVal <= Number(property.minExclusive)) {
        return `Must be greater than ${property.minExclusive}`;
      }
      if (property.maxExclusive != null && numVal >= Number(property.maxExclusive)) {
        return `Must be less than ${property.maxExclusive}`;
      }
    }
  }

  return '';
}

/**
 * Validate all fields at once (for submit-time gate).
 * Returns an array of errors; empty array means all valid.
 */
export function validateAllFields(
  properties: PropertyShapeWire[],
  data: Record<string, any>,
): FieldError[] {
  const errors: FieldError[] = [];
  for (const prop of properties) {
    if (!prop.nodeKind) continue; // skip incomplete shapes
    const msg = validateField(prop, data[prop.label]);
    if (msg) {
      errors.push({ propertyLabel: prop.label, message: msg });
    }
  }
  return errors;
}
