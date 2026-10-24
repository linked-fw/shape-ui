import { motion } from 'framer-motion';
import { Button } from '@_linked/primitives/components/Button';
import { Select } from '@_linked/primitives/components/Select';
import type { NodeShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import { shacl } from '@_linked/core/ontologies/shacl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDataManagerHost } from '../hostContext.js';
import { Spinner } from '@_linked/primitives/components/Spinner';
import { useFormDependencies } from '../shape/useFormDependencies.js';
import {
  getTransition,
  staggerContainer,
  staggerItem,
  useReducedMotion,
} from '@_linked/primitives/motion';
import {
  type CodeUsageData,
  type PropertyUsageData,
  classifyProperties,
  getVisibleProperties,
} from '../shape/propertyVisibility.js';
import { validateAllFields } from '../shape/validation.js';
import { DynamicForm } from './DynamicFormField.js';
import { inheritedFromName } from '../shape/inheritance.js';
// Shared by both form organisms — named for what it is, rather than one of its two
// consumers importing the other's stylesheet.
import style from './forms.module.css';

interface AddInstanceFormsProps {
  /**
   * Persist the new instance and return its id.
   *
   * Optional. Falls back to the host's `createInstance`, which is itself filled in from the
   * DSL — so a host that wires nothing still gets a working save. It was required, which
   * quietly made the package's "saving works with no host wiring" untrue through the one
   * surface that does the saving: a consumer had to reach for `useDataManagerHost()` and
   * thread the method back in.
   *
   * Override it when the save has to do more than write the instance — record an edit, flush
   * a draft — which is why the seam exists at all.
   */
  onSave?: (formData: Record<string, any>) => Promise<{id: string}>;
  /**
   * @deprecated Retained only for callers that still pass it; the organism no longer uses
   * it for persistence. Remove once every caller supplies `onSave`.
   */
  projectId?: string;
  shapeId: string;
  shape: NodeShapeWire;
  allShapes?: Record<string, NodeShapeWire>;
  onComplete: (newId: string, formData?: Record<string, any>) => void;
  onCancel?: () => void;
  initialData?: Record<string, any>;
  draftId?: string;
  onFieldChange?: (data: Record<string, any>) => void;
  onFlushDraft?: (data: Record<string, any>) => Promise<string | void> | string | void;
  onClearDraft?: () => void;
  propertyUsage?: Record<string, PropertyUsageData> | null;
  codeUsage?: Record<string, CodeUsageData> | null;
}

function AddInstanceForms({
  onSave,
  projectId,
  shapeId,
  shape,
  allShapes,
  onComplete,
  onCancel,
  initialData,
  draftId,
  onFieldChange,
  onFlushDraft,
  onClearDraft,
  propertyUsage,
  codeUsage,
}: AddInstanceFormsProps) {
  const reducedMotion = useReducedMotion();
  const formDataRef = useRef<Record<string, any>>(initialData ? { ...initialData } : {});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [extraFields, setExtraFields] = useState<Set<string>>(new Set());

  // Dependent field visibility & narrowing
  const host = useDataManagerHost();
  const {
    depMap,
    onParentValueChange,
    initFromData,
    isParent,
    getDependencyState,
  } = useFormDependencies(shape, allShapes || null, projectId, host.readInstance);

  // Proxy wraps formDataRef.current — intercepts property sets to detect field changes
  // and trigger dependency updates when parent fields change.
  const proxyOf = useMemo(() => {
    return new Proxy(formDataRef.current, {
      set(target, prop, value) {
        const propLabel = prop as string;
        const oldValue = target[propLabel];
        target[propLabel] = value;
        onFieldChange?.(target);

        // If this property is a parent in the dependency graph,
        // notify the dependency system and clear dependent field values.
        // Only cascade when the value actually changed (not init write-backs).
        if (isParent(propLabel)) {
          let changed: boolean;
          if (oldValue == null || value == null) {
            changed = oldValue !== value;
          } else if (Array.isArray(oldValue) && Array.isArray(value)) {
            changed =
              oldValue.length !== value.length ||
              oldValue.some((o, i) => o?.id !== value[i]?.id);
          } else if (typeof oldValue === 'object' && typeof value === 'object') {
            changed = oldValue.id !== value.id;
          } else {
            changed = oldValue !== value;
          }

          if (changed) {
            onParentValueChange(propLabel, value);
            // Cascade reset: clear child field values
            for (const [childLabel, deps] of depMap) {
              if (deps.some((d) => d.parentLabel === propLabel)) {
                target[childLabel] = undefined;
              }
            }
          }
        }

        return true;
      },
    });
  }, [depMap, onParentValueChange, isParent]);

  // Initialize dependency state from draft/initial data
  useEffect(() => {
    if (initialData) {
      initFromData(initialData);
    }
  }, []);

  // Immediate save for use before pick navigation — returns draftId
  const handleBeforeNavigate = useCallback(async (): Promise<string | void> => {
    if (!onFlushDraft) return;
    return await onFlushDraft(formDataRef.current);
  }, [onFlushDraft]);

  const handleSave = async () => {
    setSaveError(null);

    // Submit-time validation
    const errors = validateAllFields(shape.propertyShapes, formDataRef.current);
    if (errors.length > 0) {
      const errorMap: Record<string, string> = {};
      errors.forEach((e) => { errorMap[e.propertyLabel] = e.message; });
      setFieldErrors(errorMap);
      return;
    }
    setFieldErrors({});

    setIsSaving(true);
    try {
      const persist =
        onSave ?? ((data: Record<string, any>) => host.createInstance!(shapeId, data));
      const result = await persist(formDataRef.current);
      onComplete(result.id, formDataRef.current);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setIsSaving(false);
    }
  };

  if (!shape) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className={style.container}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reducedMotion ? 0 : 0.4,
          ease: [0.4, 0, 0.2, 1],
          delay: reducedMotion ? 0 : 0.1,
        }}
      >
        <motion.div
          className={style.rows}
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {(() => {
            const classified = classifyProperties(shape.propertyShapes, propertyUsage || null, { codeUsage });
            const autoVisible = getVisibleProperties(classified, 'form-add');
            const autoVisibleLabels = new Set(autoVisible.map((c) => c.property.label));

            const visibleProps = shape.propertyShapes.filter(
              (p) => autoVisibleLabels.has(p.label) || extraFields.has(p.label)
            );
            const availableExtras = classified.filter(
              (c) => !autoVisibleLabels.has(c.property.label) && !extraFields.has(c.property.label)
            );

            return (
              <>
                {visibleProps.map((propShape, i) => {
                  let required = propShape.minCount > 0;
                  let formName = propShape.label;
                  let label = propShape.label
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/_/g, ' ')
                    .replace(/^./, (char) => char.toUpperCase());

                  let dataType;
                  let nodeKind = propShape.nodeKind;
                  if (nodeKind?.id === shacl.Literal.id) {
                    dataType = propShape.datatype?.id.split('#')[1];
                  }
                  if (nodeKind?.id === shacl.IRI.id) {
                    dataType = 'nodeShape';
                  }

                  return (
                    <motion.div
                      key={propShape.label}
                      variants={staggerItem}
                      transition={getTransition(reducedMotion)}
                    >
                      <DynamicForm
                        dataType={dataType}
                        formName={formName}
                        label={label}
                        placeholder={`Type ${label.toLowerCase()} here`}
                        required={required}
                        value={formDataRef.current[propShape.label]}
                        of={proxyOf as any}
                        property={propShape}
                        shape={null}
                        onBeforeNavigate={handleBeforeNavigate}
                        error={fieldErrors[propShape.label]}
                        dependencyState={getDependencyState(propShape.label)}
                        inheritedFrom={inheritedFromName(propShape, allShapes)}
                      />
                    </motion.div>
                  );
                })}
                {availableExtras.length > 0 && (
                  <motion.div
                    variants={staggerItem}
                    transition={getTransition(reducedMotion)}
                    className={style.addFieldSection}
                  >
                    <Select.Root
                      value=""
                      onValueChange={(label) =>
                        setExtraFields((prev) => new Set(prev).add(label))
                      }
                    >
                      <Select.Trigger aria-label="Add optional field">
                        <Select.Value placeholder="+ Add optional field..." />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Group>
                          {availableExtras.map((c) => {
                            const fieldLabel = c.property.label
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/_/g, ' ')
                              .replace(/^./, (char) => char.toUpperCase());
                            const origin = inheritedFromName(c.property, allShapes);
                            return (
                              <Select.Item
                                key={c.property.label}
                                value={c.property.label}
                                textValue={fieldLabel}
                              >
                                {fieldLabel}
                                {origin && (
                                  <span className={style.inheritedFrom}> · from {origin}</span>
                                )}
                              </Select.Item>
                            );
                          })}
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </motion.div>
                )}
              </>
            );
          })()}
        </motion.div>
      </motion.div>

      {saveError && (
        <p className={style.saveError}>{saveError}</p>
      )}

      <motion.div
        className={style.actions}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reducedMotion ? 0 : 0.3,
          ease: [0.4, 0, 0.2, 1],
          delay: reducedMotion ? 0 : 0.3,
        }}
      >
        {draftId && (
          <Button variant="ghost" onClick={onClearDraft} disabled={isSaving}>
            Clear Form
          </Button>
        )}
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <><Spinner size="small" /> Creating</>
          ) : (
            'Create'
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default AddInstanceForms;
