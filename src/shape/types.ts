/**
 * Shape Builder Types
 *
 * Type definitions for SHACL shapes used in the Shape Builder.
 * Shapes define validation constraints and form generation rules for ontology classes.
 *
 * Key concepts:
 * - NodeShape: Top-level shape targeting a class (sh:targetClass)
 * - PropertyShape: Constraints for a property path within a NodeShape
 * - PropertyGroup: UI organization for form generation (sh:group)
 * - PropertyPath: Simple or complex property paths (sh:path)
 */

// ============================================================================
// Target Types
// ============================================================================

/**
 * Target type for a NodeShape - determines what the shape validates
 */
export type ShapeTargetType =
  | 'targetClass' // sh:targetClass - instances of a class (most common)
  | 'targetNode' // sh:targetNode - specific URIs
  | 'targetSubjectsOf' // sh:targetSubjectsOf - subjects of property
  | 'targetObjectsOf'; // sh:targetObjectsOf - objects of property

// ============================================================================
// Node Kind & Datatype Types
// ============================================================================

/**
 * Node kind constraint (sh:nodeKind)
 */
export type NodeKind =
  | 'IRI' // sh:IRI - must be a URI
  | 'Literal' // sh:Literal - must be a literal value
  | 'BlankNode' // sh:BlankNode - must be a blank node
  | 'BlankNodeOrIRI' // sh:BlankNodeOrIRI
  | 'BlankNodeOrLiteral' // sh:BlankNodeOrLiteral
  | 'IRIOrLiteral'; // sh:IRIOrLiteral

/**
 * XSD datatypes for literal constraints (sh:datatype)
 */
export type ShaclDatatype =
  | 'xsd:string'
  | 'xsd:integer'
  | 'xsd:decimal'
  | 'xsd:float'
  | 'xsd:double'
  | 'xsd:boolean'
  | 'xsd:date'
  | 'xsd:dateTime'
  | 'xsd:time'
  | 'xsd:anyURI'
  | 'xsd:language'
  | 'rdf:langString' // String with language tag
  | 'rdf:HTML'; // HTML content

/**
 * Mapping from user-friendly types to XSD datatypes
 */
export const DATATYPE_MAP: Record<string, ShaclDatatype> = {
  text: 'xsd:string',
  string: 'xsd:string',
  integer: 'xsd:integer',
  number: 'xsd:decimal',
  decimal: 'xsd:decimal',
  float: 'xsd:float',
  double: 'xsd:double',
  boolean: 'xsd:boolean',
  date: 'xsd:date',
  datetime: 'xsd:dateTime',
  time: 'xsd:time',
  uri: 'xsd:anyURI',
  url: 'xsd:anyURI',
  language: 'xsd:language',
  langString: 'rdf:langString',
  html: 'rdf:HTML',
};

// ============================================================================
// Property Path Types
// ============================================================================

/**
 * Property path types (SPARQL property paths)
 */
export type PropertyPathType =
  | 'predicate' // Simple: ex:name
  | 'sequence' // A/B: ex:knows/ex:name
  | 'alternative' // A|B: ex:father|ex:mother
  | 'inverse' // ^A: ^ex:parent
  | 'zeroOrMore' // A*: ex:knows*
  | 'oneOrMore' // A+: ex:knows+
  | 'zeroOrOne'; // A?: ex:middleName?

/**
 * A segment in a property path
 */
export interface PropertyPathSegment {
  /** The type of this segment */
  type: PropertyPathType;

  /** For predicate: the property URI */
  predicateUri?: string;

  /** For predicate: human-readable name */
  predicateName?: string;

  /** For predicate: namespace prefix (e.g., "schema", "adms") */
  predicatePrefix?: string;

  /** For sequence/alternative: nested segments */
  segments?: PropertyPathSegment[];

  /** For inverse: the inverted path */
  inversePath?: PropertyPathSegment;
}

/**
 * Complete property path definition
 */
export interface PropertyPath {
  /** Unique ID for this path */
  id: string;

  /** Human-readable name (e.g., "Friend's Email") */
  name: string;

  /** The root segment of the path */
  root: PropertyPathSegment;

  /** Serialized SPARQL path (e.g., "ex:knows/ex:email") */
  sparqlPath: string;

  /** Serialized Turtle path for SHACL */
  turtlePath: string;

  /** The final property in the path (determines constraints) */
  finalProperty: {
    uri: string;
    name: string;
    propertyType: 'object' | 'datatype';
    rangeClassUri?: string; // For object properties
    rangeDatatype?: string; // For datatype properties
  };
}

// ============================================================================
// Property Group Types
// ============================================================================

/**
 * Property Group for organizing properties in forms (sh:PropertyGroup)
 */
export interface BuilderPropertyGroup {
  /** Unique ID */
  id: string;

  /** Group name (e.g., "Personal Information") */
  name: string;

  /** Optional description */
  description?: string;

  /** Display order (0-based) */
  order: number;

  /** Is this the default group? */
  isDefault?: boolean;
}

// ============================================================================
// Constraint Types
// ============================================================================

/**
 * Cardinality constraints (sh:minCount, sh:maxCount)
 */
export interface CardinalityConstraint {
  /** Minimum count (0 = optional) */
  minCount?: number;

  /** Maximum count (undefined = unlimited) */
  maxCount?: number;
}

/**
 * String-based constraints (for xsd:string, rdf:langString)
 */
export interface StringConstraints {
  /** Minimum string length (sh:minLength) */
  minLength?: number;

  /** Maximum string length (sh:maxLength) */
  maxLength?: number;

  /** Regex pattern the value must match (sh:pattern) */
  pattern?: string;

  /** Regex flags for pattern (sh:flags, e.g., "i" for case-insensitive) */
  flags?: string;

  /** Allowed languages (sh:languageIn, e.g., ['en', 'nl']) */
  languageIn?: string[];

  /** Each language can appear only once (sh:uniqueLang) */
  uniqueLang?: boolean;
}

/**
 * Numeric constraints (for xsd:integer, xsd:decimal, etc.)
 */
export interface NumericConstraints {
  /** Value must be > this (sh:minExclusive) */
  minExclusive?: number;

  /** Value must be >= this (sh:minInclusive) */
  minInclusive?: number;

  /** Value must be < this (sh:maxExclusive) */
  maxExclusive?: number;

  /** Value must be <= this (sh:maxInclusive) */
  maxInclusive?: number;
}

/**
 * A value that can be a node or literal with datatype/language
 */
export interface PropertyValue {
  /** The actual value (URI string or literal value) */
  value: string;

  /** Is this an IRI/URI reference? */
  isUri?: boolean;

  /** For literals: the XSD datatype */
  datatype?: string;

  /** For literals: the language tag */
  language?: string;
}

/**
 * Value constraints (sh:in, sh:hasValue, etc.)
 */
export interface ValueConstraints {
  /** Value must be one of these (sh:in) */
  inValues?: PropertyValue[];

  /** Must have exactly this value (sh:hasValue) */
  hasValue?: PropertyValue;

  /** Must equal value of another property (sh:equals) */
  equals?: string; // Property path

  /** Must not equal value of another property (sh:disjoint) */
  disjoint?: string; // Property path

  /** Must be less than value of another property (sh:lessThan) */
  lessThan?: string; // Property path

  /** Must be <= value of another property (sh:lessThanOrEquals) */
  lessThanOrEquals?: string; // Property path
}

/**
 * Qualified Value Shape constraint (sh:qualifiedValueShape)
 * Allows: "At least N values must conform to shape X"
 */
export interface QualifiedValueConstraint {
  /** Reference to a shape that values must conform to */
  qualifiedValueShape: string; // Shape URI

  /** Minimum count of values that must conform (sh:qualifiedMinCount) */
  qualifiedMinCount?: number;

  /** Maximum count of values that may conform (sh:qualifiedMaxCount) */
  qualifiedMaxCount?: number;

  /** If true, sibling shapes are considered disjoint (sh:qualifiedValueShapesDisjoint) */
  qualifiedValueShapesDisjoint?: boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Severity levels for validation results (sh:severity)
 */
export type ShapeSeverity = 'Violation' | 'Warning' | 'Info';

/**
 * Localized message for validation results (sh:message)
 */
export interface LocalizedMessage {
  /** The message text */
  text: string;

  /** Language tag (e.g., "en", "de", "nl") */
  lang?: string;
}

// ============================================================================
// Property Shape Types
// ============================================================================

/**
 * Constraints for object properties (owl:ObjectProperty)
 */
export interface ObjectPropertyConstraints {
  /** Required rdf:type of the value (sh:class) */
  class?: string; // URI

  /** Reference to a NodeShape for nested validation (sh:node) */
  nodeShape?: string; // Shape URI
}

/**
 * Constraints for datatype properties (owl:DatatypeProperty)
 */
export interface DatatypePropertyConstraints {
  /** Required XSD datatype (sh:datatype) */
  datatype: ShaclDatatype;

  /** String-specific constraints */
  stringConstraints?: StringConstraints;

  /** Numeric-specific constraints */
  numericConstraints?: NumericConstraints;
}

/**
 * PropertyShape - defines constraints for a single property path
 */
export interface BuilderPropertyShape {
  /** Unique ID */
  id: string;

  /** Human-readable name (required because path might be complex) */
  name: string;

  /** Description of what this property represents */
  description?: string;

  /** The property path this shape constrains */
  path: PropertyPath;

  /** Display order within group (sh:order) */
  order: number;

  /** Group this property belongs to (sh:group) */
  groupId: string;

  // === Type-specific constraints ===

  /**
   * For Object Properties (final property is owl:ObjectProperty):
   * - sh:class - the rdf:type required for the value
   * - OR sh:node - reference to another NodeShape
   */
  objectConstraints?: ObjectPropertyConstraints;

  /**
   * For Datatype Properties (final property is owl:DatatypeProperty):
   */
  datatypeConstraints?: DatatypePropertyConstraints;

  /** Node kind constraint (sh:nodeKind, usually inferred from property type) */
  nodeKind?: NodeKind;

  /** Cardinality (sh:minCount, sh:maxCount) */
  cardinality: CardinalityConstraint;

  /** Value constraints (sh:in, sh:hasValue, sh:equals, etc.) */
  valueConstraints?: ValueConstraints;

  /** Qualified value shape constraint (sh:qualifiedValueShape) */
  qualifiedValue?: QualifiedValueConstraint;

  /** Is this property deactivated? (sh:deactivated) */
  deactivated?: boolean;

  /** Severity level for violations (sh:severity, default: Violation) */
  severity?: ShapeSeverity;

  /** Custom validation messages (sh:message) */
  messages?: LocalizedMessage[];

  /** Default value for form generation (sh:defaultValue) */
  defaultValue?: PropertyValue;

  /**
   * Nested property shapes (sh:property on a PropertyShape)
   * Used when the values of this property must have their own property constraints.
   * E.g., an "address" property where the address value must have city, postalCode, etc.
   * Note: This is different from sh:node which references an external shape.
   */
  nestedPropertyShapes?: BuilderPropertyShape[];

  // === UI/Display Properties (host app extensions) ===

  /** Is this a unique identifier property? */
  isUniqueIdentifier?: boolean;

  /** Is this the primary display property? */
  isPrimaryDisplay?: boolean;

  /** Display priority for compact views (lower = more important) */
  displayPriority?: number;

  /** Visual position in visual builder */
  visualPosition?: { x: number; y: number };
}

// ============================================================================
// Logical Constraint Types
// ============================================================================

/**
 * Boolean logic for combining property shapes
 */
export interface LogicalConstraint {
  /** Type of logical operation */
  type: 'and' | 'or' | 'not' | 'xone';

  /** Property shapes or nested shapes involved */
  shapes: string[]; // PropertyShape IDs or NodeShape URIs
}

// ============================================================================
// Display Ordering Types
// ============================================================================

/**
 * Display context types for property ordering
 *
 * - single: Show 1 most identifying property (e.g., name badge)
 * - small: Show up to 3 key properties (e.g., compact list item)
 * - card: Show up to 6 summary properties (e.g., card view)
 * - table: Show properties suitable for table columns (unlimited)
 */
export type DisplayContext = 'single' | 'small' | 'card' | 'table';

/**
 * Property display order for a specific context
 */
export interface PropertyDisplayOrder {
  /** Property IDs in display order */
  propertyIds: string[];
  /** Whether this uses auto-generated defaults (false = user customized) */
  isAutoGenerated: boolean;
}

/**
 * Context-specific property orderings for a shape
 *
 * Each shape can have different property orders for different display contexts.
 * If a context order is not specified or isAutoGenerated is true, the system
 * will compute a sensible default based on property metadata.
 *
 * Auto-generation rules:
 * - single: First required property, or first with highest importance
 * - small: First 2-3 properties by required status, then importance
 * - card: First 4-5 properties for summary display
 * - form: All properties in their default order
 * - table: All non-multiline properties suitable for columns
 */
export interface ShapeDisplayOrderings {
  /** Single property display (most identifying property) */
  single?: PropertyDisplayOrder;
  /** Small display (2-3 key properties) */
  small?: PropertyDisplayOrder;
  /** Card display (summary view, 4-5 properties) */
  card?: PropertyDisplayOrder;
  /** Form display (all editable properties) */
  form?: PropertyDisplayOrder;
  /** Table display (column order) */
  table?: PropertyDisplayOrder;
}

// ============================================================================
// Node Shape Types
// ============================================================================

/**
 * NodeShape - the top-level shape definition (sh:NodeShape)
 */
export interface BuilderNodeShape {
  /** Unique ID (local to builder) */
  id: string;

  /** Full URI of this shape */
  uri: string;

  /** Human-readable name (sh:name or rdfs:label) */
  name: string;

  /** Description (rdfs:comment or sh:description) */
  description?: string;

  // === Versioning ===

  /** Current version string (e.g., "1.2.3" or "1.2.3-draft") */
  version: string;

  /** Version status */
  versionStatus: 'draft' | 'published' | 'deprecated' | 'archived';

  /** For deprecated versions: recommended replacement URI */
  supersededBy?: string;

  /** URI this was forked from (if any) */
  forkedFrom?: string;

  // === Targeting ===

  /** How this shape targets nodes (sh:targetClass, sh:targetNode, etc.) */
  targetType: ShapeTargetType;

  /** For targetClass: the class URI from ontology (sh:targetClass) */
  targetClass?: string;

  /** For targetNode: specific URIs (sh:targetNode) */
  targetNodes?: string[];

  /** For targetSubjectsOf/targetObjectsOf: the property URI */
  targetProperty?: string;

  // === Structure ===

  /** Property groups (ordered, for form organization) */
  groups: BuilderPropertyGroup[];

  /** Property shapes (ordered within groups) */
  propertyShapes: BuilderPropertyShape[];

  /** Logical constraints combining properties (sh:and, sh:or, sh:not, sh:xone) */
  logicalConstraints?: LogicalConstraint[];

  // === Validation Behavior ===

  /** If true, only declared properties are allowed (sh:closed) */
  closed?: boolean;

  /** Properties to ignore when closed (sh:ignoredProperties) */
  ignoredProperties?: string[];

  /** Is this shape deactivated? (sh:deactivated) */
  deactivated?: boolean;

  // === Inheritance ===

  /** Parent shape URIs this shape extends (conceptual, not SHACL standard) */
  extendsShapes?: string[];

  // === Metadata ===

  /** Ontology this shape belongs to */
  ontologyUri: string;

  /** Ontology prefix for generated URIs */
  ontologyPrefix?: string;

  /** Package name for linked.cm URI generation (derived from project name) */
  packageName?: string;

  /** Owner project ID(s) */
  ownerProjectIds?: string[];

  /** Visibility (private/public) */
  visibility?: 'local' | 'shared' | 'public';

  /** License URI (required for public shapes) */
  license?: string;

  /** Created timestamp */
  createdAt: string;

  /** Updated timestamp */
  updatedAt: string;

  /** Visual position in visual builder */
  visualPosition?: { x: number; y: number };

  // === UI/Display Properties (host app extensions) ===

  /** Icon identifier for the shape */
  icon?: string;

  /** Icon color (hex or named) */
  iconColor?: string;

  /** Feature tier (essential or complete) */
  featureTier?: 'essential' | 'complete';

  // === Discovery & Catalog ===

  /** Search tags/keywords for catalog discovery */
  tags?: string[];

  /** Featured flag for highlighting in catalog */
  featured?: boolean;

  /** Category for catalog organization */
  category?: string;

  // === Display Orderings ===

  /**
   * Context-specific property orderings for different display scenarios.
   * If not specified or isAutoGenerated is true, defaults are computed.
   */
  displayOrderings?: ShapeDisplayOrderings;
}

// ============================================================================
// Draft Types
// ============================================================================

/**
 * Shape Builder Draft - complete builder state
 * Mirrors OntologyDraft pattern from ontology builder
 */
export interface ShapeBuilderDraft {
  /** Unique draft ID */
  id: string;

  /** Associated ontology URI */
  ontologyUri: string;

  /** Associated ontology prefix */
  ontologyPrefix: string;

  /** All node shapes in this draft */
  nodeShapes: BuilderNodeShape[];

  /** Currently selected shape ID (for UI) */
  selectedShapeId?: string;

  /** Draft version for migrations */
  version: number;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

/** Current draft version for migrations */
export const CURRENT_SHAPE_DRAFT_VERSION = 1;

// ============================================================================
// Validation Result Types
// ============================================================================

export type ShapeValidationSeverity = 'error' | 'warning' | 'info';

export interface ShapeValidationIssue {
  severity: ShapeValidationSeverity;
  message: string;
  element?: {
    type: 'nodeShape' | 'propertyShape' | 'group';
    id?: string;
    name?: string;
  };
  field?: string;
  rule: string;
  suggestion?: string;
  autoFixable?: boolean;
}

export interface ShapeValidationResult {
  valid: boolean;
  publishable: boolean;
  errorCount: number;
  warningCount: number;
  issues: ShapeValidationIssue[];
  validatedAt: string;
}

// ============================================================================
// Type Guards & Helpers
// ============================================================================

/**
 * Check if a property shape targets an object property
 */
export function isObjectPropertyShape(shape: BuilderPropertyShape): boolean {
  return shape.path.finalProperty.propertyType === 'object';
}

/**
 * Check if a property shape targets a datatype property
 */
export function isDatatypePropertyShape(shape: BuilderPropertyShape): boolean {
  return shape.path.finalProperty.propertyType === 'datatype';
}

/**
 * Get the effective nodeKind for a property shape
 */
export function getEffectiveNodeKind(shape: BuilderPropertyShape): NodeKind {
  if (shape.nodeKind) return shape.nodeKind;
  return isObjectPropertyShape(shape) ? 'IRI' : 'Literal';
}

/**
 * Check if cardinality means "required"
 */
export function isRequired(cardinality: CardinalityConstraint): boolean {
  return (cardinality.minCount ?? 0) >= 1;
}

/**
 * Check if cardinality means "single value"
 */
export function isSingleValue(cardinality: CardinalityConstraint): boolean {
  return cardinality.maxCount === 1;
}

/**
 * Serialize a PropertyValue to Turtle syntax
 */
export function serializePropertyValue(value: PropertyValue): string {
  if (value.isUri) {
    return `<${value.value}>`;
  }
  if (value.language) {
    return `"${value.value}"@${value.language}`;
  }
  if (value.datatype) {
    return `"${value.value}"^^${value.datatype}`;
  }
  return `"${value.value}"`;
}

/**
 * Check if datatype is numeric
 */
export function isNumericDatatype(datatype?: ShaclDatatype): boolean {
  if (!datatype) return false;
  return ['xsd:integer', 'xsd:decimal', 'xsd:float', 'xsd:double'].includes(
    datatype
  );
}

/**
 * Check if datatype is string-based
 */
export function isStringDatatype(datatype?: ShaclDatatype): boolean {
  if (!datatype) return false;
  return ['xsd:string', 'rdf:langString', 'rdf:HTML'].includes(datatype);
}

// ============================================================================
// Simple Builder Input Types (for easier hook/form usage)
// ============================================================================

/**
 * Simple property path for builder inputs (just the predicate URI)
 * Used for basic cases where we just need a single predicate
 */
export interface SimplePropertyPath {
  type: 'predicate';
  predicate: string; // The property URI
  predicateName?: string; // Display name
}

/**
 * Simplified property shape for builder forms
 * Flat structure that's easier to work with in forms/hooks
 */
export interface SimplePropertyShape {
  id: string;
  uri?: string;
  name: string;
  description?: string;

  /** Simple path (just the predicate URI) */
  path?: SimplePropertyPath;

  /** Display order */
  order?: number;

  /** Group ID */
  groupId?: string;

  // Cardinality (flat)
  minCount?: number;
  maxCount?: number;

  // Value type
  datatype?: string; // XSD datatype URI
  classUri?: string; // For object properties
  nodeKind?: NodeKind;

  // String constraints (flat)
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  flags?: string;

  // Numeric constraints (flat)
  minInclusive?: number;
  maxInclusive?: number;
  minExclusive?: number;
  maxExclusive?: number;

  // Display properties
  displayPriority?: number;
  isPrimaryDisplay?: boolean;
  isUniqueIdentifier?: boolean;
}

/**
 * Simplified node shape for builder forms
 */
export interface SimpleNodeShape {
  id: string;
  uri?: string;
  name: string;
  description?: string;

  version: string;
  versionStatus: 'draft' | 'published' | 'deprecated';

  targetType: ShapeTargetType;
  targetClass?: string;

  groups: BuilderPropertyGroup[];
  propertyShapes: SimplePropertyShape[];

  closed?: boolean;

  ontologyUri: string;
  ontologyPrefix?: string;
  ownerProjectIds?: string[];
  visibility?: 'local' | 'shared' | 'public';

  icon?: string;
  iconColor?: string;
  visualPosition?: { x: number; y: number };

  createdAt?: string;
  updatedAt?: string;
  featureTier?: 'essential' | 'complete';
}

/**
 * Convert a SimplePropertyShape to a full BuilderPropertyShape
 */
export function simpleToFullPropertyShape(simple: SimplePropertyShape): BuilderPropertyShape {
  const path = simple.path
    ? createSimplePath(simple.path.predicate, simple.path.predicateName)
    : createSimplePath('http://example.org/unknownProperty', simple.name);

  // Update final property type based on constraints
  if (simple.classUri) {
    path.finalProperty.propertyType = 'object';
    path.finalProperty.rangeClassUri = simple.classUri;
  } else if (simple.datatype) {
    path.finalProperty.propertyType = 'datatype';
    path.finalProperty.rangeDatatype = simple.datatype;
  }

  return {
    id: simple.id,
    name: simple.name,
    description: simple.description,
    path,
    order: simple.order ?? 0,
    groupId: simple.groupId || '',
    nodeKind: simple.nodeKind,
    cardinality: {
      minCount: simple.minCount,
      maxCount: simple.maxCount,
    },
    objectConstraints: simple.classUri ? { class: simple.classUri } : undefined,
    datatypeConstraints: simple.datatype ? {
      datatype: simple.datatype as ShaclDatatype,
      stringConstraints: (simple.minLength !== undefined || simple.maxLength !== undefined || simple.pattern) ? {
        minLength: simple.minLength,
        maxLength: simple.maxLength,
        pattern: simple.pattern,
        flags: simple.flags,
      } : undefined,
      numericConstraints: (simple.minInclusive !== undefined || simple.maxInclusive !== undefined ||
                          simple.minExclusive !== undefined || simple.maxExclusive !== undefined) ? {
        minInclusive: simple.minInclusive,
        maxInclusive: simple.maxInclusive,
        minExclusive: simple.minExclusive,
        maxExclusive: simple.maxExclusive,
      } : undefined,
    } : undefined,
    displayPriority: simple.displayPriority,
    isPrimaryDisplay: simple.isPrimaryDisplay,
    isUniqueIdentifier: simple.isUniqueIdentifier,
  };
}

/**
 * Convert a full BuilderPropertyShape to a SimplePropertyShape
 */
export function fullToSimplePropertyShape(full: BuilderPropertyShape): SimplePropertyShape {
  return {
    id: full.id,
    name: full.name,
    description: full.description,
    path: full.path ? {
      type: 'predicate',
      predicate: full.path.root.predicateUri || full.path.sparqlPath,
      predicateName: full.path.root.predicateName,
    } : undefined,
    order: full.order,
    groupId: full.groupId,
    minCount: full.cardinality?.minCount,
    maxCount: full.cardinality?.maxCount,
    datatype: full.datatypeConstraints?.datatype,
    classUri: full.objectConstraints?.class,
    nodeKind: full.nodeKind,
    minLength: full.datatypeConstraints?.stringConstraints?.minLength,
    maxLength: full.datatypeConstraints?.stringConstraints?.maxLength,
    pattern: full.datatypeConstraints?.stringConstraints?.pattern,
    flags: full.datatypeConstraints?.stringConstraints?.flags,
    minInclusive: full.datatypeConstraints?.numericConstraints?.minInclusive,
    maxInclusive: full.datatypeConstraints?.numericConstraints?.maxInclusive,
    minExclusive: full.datatypeConstraints?.numericConstraints?.minExclusive,
    maxExclusive: full.datatypeConstraints?.numericConstraints?.maxExclusive,
    displayPriority: full.displayPriority,
    isPrimaryDisplay: full.isPrimaryDisplay,
    isUniqueIdentifier: full.isUniqueIdentifier,
  };
}

/**
 * Generate a simple predicate path from a property URI
 */
export function createSimplePath(
  propertyUri: string,
  propertyName?: string,
  propertyType: 'object' | 'datatype' = 'datatype',
  rangeClassUri?: string,
  rangeDatatype?: string
): PropertyPath {
  const name = propertyName || propertyUri.split(/[#/]/).pop() || propertyUri;
  return {
    id: crypto.randomUUID(),
    name,
    root: {
      type: 'predicate',
      predicateUri: propertyUri,
      predicateName: name,
    },
    sparqlPath: propertyUri,
    turtlePath: `<${propertyUri}>`,
    finalProperty: {
      uri: propertyUri,
      name,
      propertyType,
      rangeClassUri,
      rangeDatatype,
    },
  };
}

// ============================================================================
// Shape Registry Types (for Catalog)
// ============================================================================

/**
 * Shape status in the registry
 */
export type ShapeStatus = 'active' | 'deprecated' | 'draft' | 'archived';

/**
 * Verification level for shapes
 */
export type ShapeVerificationLevel = 'verified' | 'community' | 'unverified';

/**
 * Shape visibility (openness level)
 * - 'local': Level 1 — lives in app's repo
 * - 'shared': Level 2 — optionally published to npm
 * - 'public': Level 3 — source in Linked org public repo
 */
export type ShapeVisibility = 'local' | 'shared' | 'public';

/**
 * Shape version information
 *
 * URI Strategy:
 * - Base URI: /shapes/{shapeName}Shape (holds metadata + latest release copy)
 * - Version URI: /shapes/{shapeName}Shape/{version} (e.g., /shapes/PersonShape/1.0.0)
 *
 * The base shape always contains:
 * - Metadata (name, description, owner, etc.)
 * - A copy of the latest published version's constraints
 * - Reference to all versions via cnSh:hasVersion
 */
export interface ShapeVersion {
  /** SemVer version string (e.g., "1.0.0", "1.2.3-beta") */
  version: string;

  /** Full URI for this version */
  versionUri: string;

  /** Status of this version */
  status: 'draft' | 'published' | 'deprecated' | 'archived';

  /** Release notes for this version */
  releaseNotes?: string;

  /** When this version was published */
  publishedAt?: string;

  /** Who published this version */
  publishedBy?: string;

  /** Is this the latest stable release? */
  isLatest?: boolean;
}

/**
 * Shape registry entry for catalog display
 *
 * Represents a shape in the catalog with metadata for discovery.
 * The base URI always holds the latest version's data.
 */
export interface ShapeRegistryEntry {
  /** Base URI for the shape (without version) */
  uri: string;

  /** Human-readable name */
  name: string;

  /** Description of what this shape validates */
  description?: string;

  /** Target class this shape validates (sh:targetClass) */
  targetClass?: string;

  /** Prefix of the target ontology */
  ontologyPrefix?: string;

  /** URI of the source ontology */
  ontologyUri?: string;

  /** Keywords/tags for discovery */
  keywords: string[];

  /** Domain categories */
  domain: string[];

  /** Current version (latest published, or draft if none published) */
  version: string;

  /** All available versions */
  versions?: ShapeVersion[];

  /** Maintainer information */
  maintainer: {
    name: string;
    type: 'organization' | 'community' | 'individual' | 'local';
    url?: string;
  };

  /** Current status */
  status: ShapeStatus;

  /** Last updated timestamp */
  lastUpdated: string;

  /** Created timestamp */
  createdAt?: string;

  /** Verification info */
  verification: {
    level: ShapeVerificationLevel;
    verifiedBy?: string[];
  };

  /** Owner project IDs (who can edit) */
  ownerProjectIds?: string[];

  /** Whether this shape is in use in current project */
  inUse?: boolean;

  /** Whether this is a local/project shape */
  isLocal?: boolean;

  /** Whether this shape is owned by current project */
  isOwned?: boolean;

  /** Icon name for UI */
  icon?: string;

  /** Icon color for UI */
  iconColor?: string;

  /** Visibility setting */
  visibility?: ShapeVisibility;

  /** License (required for public shapes) */
  license?: string;

  /** Whether this shape is featured in catalog */
  featured?: boolean;

  /** Tags for filtering */
  tags?: string[];

  /** Stats for discovery */
  stats: {
    /** Number of property shapes defined */
    propertyCount: number;

    /** Number of projects using this shape */
    usageCount: number;

    /** User rating (0-5) */
    rating?: number;

    /** Number of downloads/imports */
    downloadCount?: number;

    /** Number of forks */
    forkCount?: number;
  };
}

/**
 * Filter state for shape catalog
 */
export interface ShapeFilterState {
  /** Filter by domain/category */
  domains: string[];

  /** Filter by status */
  status: string[];

  /** Filter by ontology */
  ontology: string[];

  /** Filter by visibility */
  visibility: string[];

  /** Search query */
  searchQuery?: string;

  /** Only show featured shapes */
  featuredOnly?: boolean;

  /** Only show shapes owned by current project */
  ownedOnly?: boolean;
}
