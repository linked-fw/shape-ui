import type { PropertyShapeWire } from '@_linked/core/shapes/nodeShapeWire';

/**
 * `hidden` is a REMOVAL, not the weakest shown category.
 *
 * `optional` is still displayed — it fills the "add another field" picker and is rendered
 * in `full` and in `form-edit` whenever the instance has a value. So mapping
 * `core:displayHidden` onto `optional` did nothing at all. Hidden needs its own
 * value that every mode filters, including the "nothing qualified, show everything"
 * fallback.
 */
export type PropertyVisibility = 'required' | 'used' | 'optional' | 'hidden';

export interface PropertyUsageData {
  count: number;
  total: number;
  percentage: number;
}

/** Code analysis classification from analyze-shape-usage.ts */
export type CodeClassification =
  | 'essential'
  | 'common'
  | 'contextual'
  | 'display'
  | 'unused';

export interface CodeUsageData {
  classification: CodeClassification;
  writeRefs: number;
  readRefs: number;
}

/** Per-shape code usage manifest (keyed by shape class name → property label) */
export type CodeUsageManifest = Record<string, Record<string, CodeUsageData>>;

export interface ClassifiedProperty {
  property: PropertyShapeWire;
  visibility: PropertyVisibility;
  usage?: PropertyUsageData;
  codeUsage?: CodeUsageData;
}

/**
 * Classify properties using three signals (in priority order):
 *
 *   1. Shape constraints (SHACL): minCount > 0 → required
 *   2. Code analysis: essential/common → used; contextual/display/unused → optional
 *   3. Data usage (SPARQL): percentage >= threshold → used
 *
 * The code analysis signal is the primary differentiator for non-required
 * properties — it reflects how the shape is actually used when submitting
 * data in the project's code.
 */
export function classifyProperties(
  properties: PropertyShapeWire[],
  usageData: Record<string, PropertyUsageData> | null,
  options?: {
    usageThreshold?: number;
    codeUsage?: Record<string, CodeUsageData> | null;
  }
): ClassifiedProperty[] {
  const threshold = options?.usageThreshold ?? 1;
  const codeUsage = options?.codeUsage ?? null;

  return properties.map((prop) => {
    const usage = usageData?.[prop.label];
    const code = codeUsage?.[prop.label];
    // Display metadata the shape itself declares. Read structurally so this works for
    // both the metamodel and the derived DTO, which has no home for these fields.
    const display = prop as unknown as {
      displayHidden?: boolean;
      displayRank?: number;
    };

    let visibility: PropertyVisibility;

    // 0. The shape says not to render it. This outranks everything below, including
    //    minCount: a required property can still be one a person should not be shown.
    if (display.displayHidden === true) {
      visibility = 'hidden';
    }
    // 1. SHACL constraint: minCount > 0 means required
    else if (prop.minCount > 0) {
      visibility = 'required';
    }
    // 1b. A declared display rank is the shape stating the property matters. It is a
    //     first-party statement, so it outranks the inferred signals below.
    else if (display.displayRank != null) {
      visibility = 'used';
    }
    // 2. Code analysis: essential/common properties are "used"
    else if (
      code &&
      (code.classification === 'essential' || code.classification === 'common')
    ) {
      visibility = 'used';
    }
    // 3. Data usage: >= threshold% of instances have this property
    else if (usage && usage.percentage >= threshold) {
      visibility = 'used';
    }
    // 4. Code analysis: display properties are optional but may be shown in views
    else {
      visibility = 'optional';
    }

    return { property: prop, visibility, usage, codeUsage: code };
  });
}

export type VisibilityMode = 'auto' | 'full' | 'form-add' | 'form-edit';

/**
 * Returns true if a property value is considered "populated" (has meaningful data).
 * Handles all data types: primitives, objects ({id, label}), arrays, numbers.
 */
function hasValue(val: any): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'string') return val !== '';
  if (typeof val === 'number') return true; // 0 is a valid value
  if (typeof val === 'boolean') return true;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
}

/**
 * Filter properties to only those that should be visible in a given context.
 *
 * - auto: required + used (for tables); falls back to all if nothing qualifies
 * - full: all properties
 * - form-add: required + used (essential/common from code); falls back to all
 * - form-edit: required + used + properties with data on this instance; falls back to all
 */
export function getVisibleProperties(
  classified: ClassifiedProperty[],
  mode: VisibilityMode,
  instanceData?: Record<string, any>
): ClassifiedProperty[] {
  // Removed before any mode gets a say, and before the fallback below can reinstate it.
  const visible = classified.filter((c) => c.visibility !== 'hidden');

  let result: ClassifiedProperty[];

  switch (mode) {
    case 'full':
      return visible;

    case 'auto':
      result = visible.filter(
        (c) => c.visibility === 'required' || c.visibility === 'used'
      );
      break;

    case 'form-add':
      result = visible.filter(
        (c) => c.visibility === 'required' || c.visibility === 'used'
      );
      break;

    case 'form-edit':
      result = visible.filter((c) => {
        if (c.visibility === 'required') return true;
        if (c.visibility === 'used') return true;
        if (instanceData && hasValue(instanceData[c.property.label]))
          return true;
        return false;
      });
      break;

    default:
      return visible;
  }

  // Fallback: if filtering yields nothing, show all NON-HIDDEN properties. This handles
  // shapes that haven't declared any minCount/required yet — but it must not be a back
  // door that reinstates what the shape explicitly hid.
  return result.length > 0 ? result : visible;
}
