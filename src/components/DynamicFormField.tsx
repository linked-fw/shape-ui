import { Tooltip } from '@_linked/primitives/components/Tooltip';
import type { PropertyShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import { shacl } from '@_linked/core/ontologies/shacl';
import { isRelation } from '@_linked/core/shapes/relationShape';
import { xsd } from '@_linked/core/ontologies/xsd';
import { Shape } from '@_linked/core/shapes/Shape';
import { useState } from 'react';
import { Icons } from '@_linked/icons';
import type { FieldDependencyState } from '../shape/useFormDependencies.js';
import { getNodeDisplay, humanizeEnumLabel, enumOptions } from '../shape/nodeDisplay.js';
import { validateField } from '../shape/validation.js';
import style from './DynamicFormField.module.css';
import { FormField } from './FormField.js';
import NodeValuesEditor from './NodeValuesEditor.js';

interface DynamicFormProps {
  dataType?;
  formName: string;
  label: string;
  placeholder: string;
  required: boolean;
  value?;
  shape;
  of: Shape;
  property: PropertyShapeWire;
  onBeforeNavigate?: () => Promise<string | void> | string | void;
  /** External error from submit-time validation */
  error?: string;
  /** Dependency state from parent fields (visibility + narrowing) */
  dependencyState?: FieldDependencyState;
}

// Helper: format a Date or ISO string for <input type="date">
function toDateInputValue(val: any): string {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'string') return val.split('T')[0];
  return '';
}

// Helper: format a Date or ISO string for <input type="datetime-local">
function toDateTimeInputValue(val: any): string {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 16);
  if (typeof val === 'string') return val.slice(0, 16);
  return '';
}

/** Compute HTML min/max attrs from SHACL inclusive/exclusive constraints */
function computeNumericBounds(property: PropertyShapeWire, isInteger: boolean) {
  const attrs: Record<string, number> = {};
  if (property.minInclusive != null) {
    attrs.min = property.minInclusive;
  } else if (property.minExclusive != null) {
    // The metamodel types the bound as `string | number` — a SHACL literal can be either —
    // where the DTO had already coerced it to a number.
    const bound = Number(property.minExclusive);
    attrs.min = isInteger ? bound + 1 : bound;
  }
  if (property.maxInclusive != null) {
    attrs.max = property.maxInclusive;
  } else if (property.maxExclusive != null) {
    attrs.max = isInteger ? property.maxExclusive - 1 : property.maxExclusive;
  }
  return attrs;
}

function FieldWrapper({
  label,
  required,
  error,
  description,
  children,
}: {
  label: string;
  required: boolean;
  error?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={style.form}>
      <div className={style.label}>
        <label>
          {label} {required && <sup>*</sup>}
          {description && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  type="button"
                  className={style.infoIcon}
                  aria-label={`Info about ${label}`}
                >
                  <Icons.Info width={14} height={14} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" sideOffset={4} className={style.tooltipContent}>
                {description}
                <Tooltip.Arrow />
              </Tooltip.Content>
            </Tooltip.Root>
          )}
        </label>
      </div>
      <div className={style.value}>
        {children}
        {error && <span className={style.fieldError}>{error}</span>}
      </div>
    </div>
  );
}

function DynamicForm({
  dataType,
  formName,
  label,
  placeholder = 'Type here',
  required = false,
  value,
  shape,
  of,
  property,
  onBeforeNavigate,
  error: externalError,
  dependencyState,
}: DynamicFormProps) {
  const [localError, setLocalError] = useState('');
  const displayError = externalError || localError;

  const datatype = property.datatype;
  const nodeKind = property.nodeKind;

  const handleBlur = (val: any) => {
    const err = validateField(property, val);
    setLocalError(err);
  };

  // Guard: skip properties that say neither what kind of value they hold nor what they
  // point at (incomplete shape data). A `sh:class` or `sh:node` alone is enough: the
  // value is a node.
  if (!nodeKind && !isRelation(property)) return null;

  // ── sh:in enumeration → render as <select> dropdown (both literal and IRI) ──
  //
  // `enumOptions` derives the label. `sh:in` carries members, not names — the DTO's `inValues`
  // looked like it carried names but they were the IRI's local part, computed at projection
  // time. Same answer, computed in one place.
  const choices = enumOptions(property);
  if (choices.length > 0) {
    const currentValue =
      value !== undefined && value !== null
        ? typeof value === 'object' && value.id
          ? value.id
          : String(value)
        : '';
    return (
      <FieldWrapper label={label} required={required} error={displayError} description={property.description}>
        <select
          className={style.selectField}
          required={required}
          defaultValue={currentValue}
          onChange={(e) => {
            of[property.label] = e.target.value || undefined;
          }}
          onBlur={(e) => handleBlur(e.target.value)}
        >
          <option value="">— Select —</option>
          {choices.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </FieldWrapper>
    );
  }

  // Object / IRI properties — rendered by NodeValuesEditor (CustomMultiSelect)
  if (isRelation(property)) {
    // Dependency hint: show subtle text when parent field can narrow this field
    const narrowingHint =
      dependencyState && !dependencyState.parentHasValue
        ? dependencyState.parentLabels
            .map((l) => l.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim())
            .join(' or ')
        : null;

    return (
      <FieldWrapper label={label} required={required} error={displayError} description={property.description}>
        {narrowingHint && (
          <span className={style.narrowingHint}>
            Select {narrowingHint} to narrow options
          </span>
        )}
        <NodeValuesEditor
          sourceShape={shape}
          of={of}
          property={property}
          onBeforeNavigate={onBeforeNavigate}
          narrowedIds={dependencyState?.narrowedIds}
          isNarrowing={dependencyState?.loading}
        />
      </FieldWrapper>
    );
  }

  // Literal properties
  if (nodeKind?.id === shacl.Literal.id) {
    const dt = datatype?.id;

    // Boolean → native checkbox
    if (dt === xsd.boolean.id) {
      return (
        <FieldWrapper label={label} required={required} error={displayError} description={property.description}>
          <input
            type="checkbox"
            className={style.checkboxField}
            defaultChecked={!!value}
            onChange={(e) => { of[property.label] = e.target.checked; }}
          />
        </FieldWrapper>
      );
    }

    // Date
    if (dt === xsd.date.id) {
      return (
        <FieldWrapper label={label} required={required} error={displayError} description={property.description}>
          <input
            type="date"
            className={style.textFormField}
            required={required}
            defaultValue={toDateInputValue(value)}
            onChange={(e) => { of[property.label] = e.target.value; }}
            onBlur={(e) => handleBlur(e.target.value)}
          />
        </FieldWrapper>
      );
    }

    // DateTime
    if (dt === xsd.dateTime.id) {
      return (
        <FieldWrapper label={label} required={required} error={displayError} description={property.description}>
          <input
            type="datetime-local"
            className={style.textFormField}
            required={required}
            defaultValue={toDateTimeInputValue(value)}
            onChange={(e) => { of[property.label] = e.target.value; }}
            onBlur={(e) => handleBlur(e.target.value)}
          />
        </FieldWrapper>
      );
    }

    // Integer / long
    if (
      dt === xsd.integer.id ||
      dt === xsd.long?.id
    ) {
      const bounds = computeNumericBounds(property, true);
      return (
        <FieldWrapper label={label} required={required} error={displayError} description={property.description}>
          <input
            type="number"
            step="1"
            className={style.textFormField}
            required={required}
            defaultValue={value !== undefined && value !== null ? Number(value) : ''}
            {...bounds}
            onChange={(e) => { of[property.label] = parseInt(e.target.value, 10); }}
            onBlur={(e) => handleBlur(parseInt(e.target.value, 10))}
          />
        </FieldWrapper>
      );
    }

    // Decimal / float / double
    if (
      dt === xsd.decimal?.id ||
      dt === xsd.float?.id ||
      dt === xsd.double?.id
    ) {
      const bounds = computeNumericBounds(property, false);
      return (
        <FieldWrapper label={label} required={required} error={displayError} description={property.description}>
          <input
            type="number"
            step="any"
            className={style.textFormField}
            required={required}
            defaultValue={value !== undefined && value !== null ? Number(value) : ''}
            {...bounds}
            onChange={(e) => { of[property.label] = parseFloat(e.target.value); }}
            onBlur={(e) => handleBlur(parseFloat(e.target.value))}
          />
        </FieldWrapper>
      );
    }

    // URI / anyURI
    if (dt === 'http://www.w3.org/2001/XMLSchema#anyURI') {
      return (
        <FieldWrapper label={label} required={required} error={displayError} description={property.description}>
          <FormField
            name={formName}
            type="url"
            placeholder={placeholder}
            className={style.textFormField}
            required={required}
            defaultValue={typeof value === 'string' ? value : ''}
            onChange={(e) => { of[property.label] = e.target.value; }}
            onBlur={(e) => handleBlur(e.target.value)}
          />
        </FieldWrapper>
      );
    }

    // String (default) — also catches unknown datatypes
    const strAttrs: Record<string, any> = {};
    if (property.minLength != null) strAttrs.minLength = property.minLength;
    if (property.maxLength != null) strAttrs.maxLength = property.maxLength;
    if (property.pattern) strAttrs.pattern = property.pattern;

    return (
      <FieldWrapper label={label} required={required} error={displayError} description={property.description}>
        <FormField
          name={formName}
          type="text"
          placeholder={placeholder}
          className={style.textFormField}
          required={required}
          defaultValue={
            value !== undefined && value !== null
              ? typeof value === 'object'
                ? getNodeDisplay(value)
                : String(value)
              : ''
          }
          {...strAttrs}
          onChange={(e) => { of[property.label] = e.target.value; }}
          onBlur={(e) => {
            of[property.label] = e.target.value;
            handleBlur(e.target.value);
          }}
        />
      </FieldWrapper>
    );
  }

  return null;
}

export { DynamicForm };
