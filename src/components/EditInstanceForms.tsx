import { motion } from 'framer-motion';
import { Button } from '@_linked/primitives/components/Button';
import { Select } from '@_linked/primitives/components/Select';
import type { PropertyShapeWire, NodeShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import { shacl } from '@_linked/core/ontologies/shacl';
import { useEffect, useMemo, useState } from 'react';
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
import { DynamicForm } from './DynamicFormField.js';
// Shared by both form organisms — named for what it is, rather than one of its two
// consumers importing the other's stylesheet.
import style from './forms.module.css';

interface EditInstanceFormsProps {
  of: Record<string, any>;
  onSave?: (data: Record<string, any>) => Promise<void>;
  onCancel?: () => void;
  shape: NodeShapeWire;
  /** @deprecated Not read by this component; it will be removed. */
  properties?: Record<string, PropertyShapeWire> | null;
  allShapes?: Record<string, NodeShapeWire>;
  projectId?: string;
  propertyUsage?: Record<string, PropertyUsageData> | null;
  codeUsage?: Record<string, CodeUsageData> | null;
}

function EditInstanceForms({
  of,
  onSave,
  onCancel,
  shape,
  properties,
  allShapes,
  projectId,
  propertyUsage,
  codeUsage,
}: EditInstanceFormsProps) {
  const reducedMotion = useReducedMotion();
  const propShapes = shape.propertyShapes;
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [extraFields, setExtraFields] = useState<Set<string>>(new Set());

  // Dependent field visibility & narrowing
  const host = useDataManagerHost();
  const {
    depMap,
    onParentValueChange,
    initFromData,
    isParent,
    getDependencyState,
  } = useFormDependencies(shape, allShapes || null, projectId || null, host.readInstance);

  // Wrap `of` in a Proxy to detect parent field changes
  const proxyOf = useMemo(() => {
    return new Proxy(of, {
      set(target, prop, value) {
        const propLabel = prop as string;
        const oldValue = target[propLabel];
        target[propLabel] = value;

        if (isParent(propLabel)) {
          // Only cascade-clear children when the parent value actually changed,
          // not during initialization write-backs from CustomMultiSelect
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
  }, [of, depMap, onParentValueChange, isParent]);

  // Initialize dependency state from existing instance data
  useEffect(() => {
    if (of) {
      initFromData(of);
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave?.(of);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setIsSaving(false);
    }
  };

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
            const classified = classifyProperties(propShapes, propertyUsage || null, { codeUsage });
            const autoVisible = getVisibleProperties(classified, 'form-edit', of);
            const autoVisibleLabels = new Set(autoVisible.map((c) => c.property.label));

            const visibleProps = propShapes.filter(
              (p) => autoVisibleLabels.has(p.label) || extraFields.has(p.label)
            );
            const availableExtras = classified.filter(
              (c) => !autoVisibleLabels.has(c.property.label) && !extraFields.has(c.property.label)
            );

            return (
              <>
                {visibleProps.map((propShape) => {
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
                        value={proxyOf[propShape.label]}
                        of={proxyOf as any}
                        property={propShape}
                        shape={null}
                        dependencyState={getDependencyState(propShape.label)}
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
                          {availableExtras.map((c) => (
                            <Select.Item key={c.property.label} value={c.property.label}>
                              {c.property.label
                                .replace(/([A-Z])/g, ' $1')
                                .replace(/_/g, ' ')
                                .replace(/^./, (char) => char.toUpperCase())}
                            </Select.Item>
                          ))}
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
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <><Spinner size="small" /> Saving</>
          ) : (
            'Save'
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default EditInstanceForms;
