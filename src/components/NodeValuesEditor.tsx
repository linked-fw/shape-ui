import type { PropertyShapeWire, NodeShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import CustomMultiSelect from './CustomMultiSelect.js';
import style from './NodeValuesEditor.module.css';

//TODO: create new NodeValuesEditor component, which takes property & of props
//TODO: NodeValuesEditor will look at the property shape and determine potential Values by itself
//TODO: it also checks if the property has `inList` and then uses inList.getContents() as potential values
//TODO: it also updates the value by using of[property.label]
// it renders the MultiSelect component and provides value & multiselect props
// it also provides potentialValues to MultiSelect, which will be the instances of the relation's shape
// it renders <MultiSelect />
interface NodeValuesEditorProps {
  property: PropertyShapeWire;
  of;
  /**
   * The shape being edited. Passed down rather than read from the route: the picker needs
   * it to say which shape the answer belongs to, and the form above already knows.
   */
  sourceShape?: NodeShapeWire;
  onBeforeNavigate?: () => Promise<string | void> | string | void;
  narrowedIds?: string[] | null;
  isNarrowing?: boolean;
}
const NodeValuesEditor = ({ property, of, sourceShape, onBeforeNavigate, narrowedIds, isNarrowing }: NodeValuesEditorProps) => {
  const values = of[property.label];
  // let potentialValues = property.inList;


  return (
    <div className={style.Root}>
      <CustomMultiSelect
        values={values}
        property={property}
        sourceShape={sourceShape}
        onBeforeNavigate={onBeforeNavigate}
        narrowedIds={narrowedIds}
        isNarrowing={isNarrowing}
        onChange={(selected) => {
          // Write back to form data object (same mutation pattern as DynamicFormField)
          // Include label so draft restore can display friendly names
          of[property.label] =
            selected.length === 0
              ? undefined
              : property.maxCount === 1
                ? { id: selected[0].id, label: selected[0].label }
                : selected.map((v) => ({ id: v.id, label: v.label }));
        }}
      />
    </div>
  );
};

export default NodeValuesEditor;
