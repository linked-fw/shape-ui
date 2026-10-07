import {useState} from 'react';
import {motion} from 'framer-motion';
import {cl} from '@_linked/react/utils/ClassNames';
import type {
  PropertyShapeWire,
  NodeShapeWire,
} from '@_linked/core/shapes/nodeShapeWire';
import {NodeBadge} from './NodeBadge.js';
import ImageThumb from '@_linked/primitives/components/ImageThumb';
import {getNodeDisplay} from '../shape/nodeDisplay.js';
import {useRelationShapeResolver} from '../shape/relationShape.js';
import {
  getTransition,
  staggerContainer,
  staggerItem,
  useReducedMotion,
} from '@_linked/primitives/motion';
import style from './InstanceView.module.css';

/**
 * Read-only rendering of one instance's values.
 *
 * Lifted out of `ViewInstance` (436 lines), which rendered all of this inline. That made the
 * single-instance view the one CRUD surface with no organism at all — nothing to extract,
 * nothing to test, and nothing that could move into the package. The page keeps what a page
 * should: routing, breadcrumbs, layout chrome, actions, the deletion dialog.
 *
 * Navigation is a callback, not a router call. Clicking a related node means "show me that
 * one", and where that goes is the host's business.
 */

export interface InstanceViewProps {
  shape?: NodeShapeWire;
  /** Property metadata by label — used to resolve which shape a related node belongs to. */
  properties: Record<string, PropertyShapeWire>;
  /** The instance's values, keyed by property label. */
  subject: Record<string, any> | null;
  /**
   * A related node was clicked. Given the node and the property it came from, so the caller
   * can resolve the target shape with `useRelationShapeResolver()(properties[propertyName])`.
   */
  onNodeClick?: (node: {id: string; label?: string}, propertyName: string) => void;
}

/** Above this many values, the rest collapse behind a "(n…)" badge. */
const MAX_VALUES = 7;

export function InstanceView({
  shape,
  properties,
  subject,
  onNodeClick,
}: InstanceViewProps) {
  const [expandedArrays, setExpandedArrays] = useState<Set<string>>(new Set());
  const reducedMotion = useReducedMotion();
  const resolveRelation = useRelationShapeResolver();
  // A related node links only when its relation resolves to a shape it can be opened through.
  const linkable = (propertyName: string) => !!resolveRelation(properties[propertyName]).shapeId;

  const expand = (propertyName: string) =>
    setExpandedArrays((prev) => new Set(prev).add(propertyName));

  const handleNodeClick = (node: any, propertyName: string) => {
    if (node?.id) onNodeClick?.(node, propertyName);
  };

  /** An image source, whether the value carries one directly or via a nested ImageObject. */
  const imageSourceOf = (value: any): string | undefined => {
    const images = value?.image;
    const first = Array.isArray(images) ? images[0] : images;
    if (!first) return undefined;
    return typeof first === 'object' && first.contentUrl
      ? String(first.contentUrl)
      : String(first);
  };

  const renderArrayItem = (item: any, key: number, propertyName: string) => {
    if (typeof item === 'object' && item?.contentUrl) {
      return (
        <div key={key}>
          <ImageThumb src={item.contentUrl} size={40} alt={item.label || propertyName} />
        </div>
      );
    }
    if (typeof item === 'object' && item?.id) {
      const imgSrc = imageSourceOf(item);
      if (imgSrc) {
        return (
          <div key={key}>
            <ImageThumb src={imgSrc} size={40} alt={item.label || propertyName} />
          </div>
        );
      }
      return (
        <div key={key}>
          <NodeBadge
            text={item.label || item.id}
            onClick={() => handleNodeClick(item, propertyName)}
            clickable={linkable(propertyName)}
          />
        </div>
      );
    }
    return (
      <div key={key}>
        <NodeBadge text={String(item)} />
      </div>
    );
  };

  const renderValue = (value: any, propertyName: string) => {
    if (value === null || value === undefined) return <p>-</p>;
    if (typeof value === 'boolean') return <p>{value ? 'Yes' : 'No'}</p>;

    // An ImageObject: the value IS the image.
    if (typeof value === 'object' && value.contentUrl) {
      return (
        <div className={style.imageValue}>
          <ImageThumb src={value.contentUrl} size={64} alt={propertyName} />
          <p className={style.imageLabel}>{value.label || value.contentUrl}</p>
        </div>
      );
    }

    // A related node: show its image if it has one, else a badge (clickable when linkable).
    if (typeof value === 'object' && value.id) {
      const imgSrc = imageSourceOf(value);
      if (imgSrc) {
        return (
          <div className={style.imageValue}>
            <ImageThumb src={imgSrc} size={48} alt={value.label || propertyName} />
            {value.label && <span className={style.imageLabel}>{value.label}</span>}
          </div>
        );
      }
      return (
        <NodeBadge
          text={getNodeDisplay(value)}
          onClick={() => handleNodeClick(value, propertyName)}
          clickable={linkable(propertyName)}
        />
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <p>-</p>;
      const isExpanded = expandedArrays.has(propertyName);
      const visible = isExpanded ? value : value.slice(0, MAX_VALUES);
      const leftOver = value.length - MAX_VALUES;
      return (
        <div className={style.badgeContainer}>
          {visible.map((item, index) => renderArrayItem(item, index, propertyName))}
          {!isExpanded && leftOver > 0 && (
            <div>
              <NodeBadge
                text={`(${leftOver}...)`}
                onClick={() => expand(propertyName)}
                clickable
              />
            </div>
          )}
        </div>
      );
    }

    return <p>{String(value)}</p>;
  };

  if (!subject) return null;

  // Only properties that actually have a value, and never the identifier — it names the
  // record rather than describing it.
  const populated = (shape?.propertyShapes ?? []).filter((prop) => {
    if (prop.label === 'id') return false;
    const value = subject[prop.label];
    return value !== undefined && value !== null && value !== '';
  });

  return (
    <motion.div
      className={style.rows}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {populated.map((prop) => {
        const value = subject[prop.label];
        const formattedLabel =
          prop.label.charAt(0).toUpperCase() + prop.label.slice(1);
        const isStacked = shouldStack(value);
        return (
          <motion.div
            key={prop.label}
            className={cl(style.form, isStacked && style.stacked)}
            variants={staggerItem}
            transition={getTransition(reducedMotion)}
          >
            <div className={style.label}>
              <label>{formattedLabel}</label>
            </div>
            <div className={style.value}>{renderValue(value, prop.label)}</div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/** A value wide enough that label-beside-value stops reading well. */
function shouldStack(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 3;
  if (typeof value === 'string') return value.length > 120;
  return false;
}

export default InstanceView;
