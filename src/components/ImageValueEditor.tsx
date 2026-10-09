import React, { useState, useEffect } from 'react';
import type { PropertyShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import style from './ImageValueEditor.module.css';
// import CustomMultiSelect from './CustomMultiSelect.js';
import { Shape } from '@_linked/core/shapes/Shape';
import { PropertyShape, NodeShape } from '@_linked/core/shapes/SHACL';
import { Thing } from '@_linked/schema/shapes/Thing';
import { getShapeClass } from '@_linked/core/utils/ShapeClass';
import { ShapeSet } from '@_linked/core/collections/ShapeSet';
import { ImageUploader } from '@_linked/schema/components/ImageUploader';
import { ImageObject } from '@_linked/schema/shapes/ImageObject';
import { generateRandomName } from '../utils/helper.js';

// interface ImageValuesEditor {
//   shape?: Shape;
//   property?: PropertyShapeWire;
//   potentialValues?: any[];
//   createInstanceFor?;
// }

interface ImageValueEditorProps {
  of?: Record<string, any>;
  property?: PropertyShapeWire;
  shape: NodeShape;
  thumbnailWidth?: number;
  potentialValue?;
}
const ImageValueEditor = ({
  of,
  property,
  shape,
  potentialValue,
  thumbnailWidth,
}: ImageValueEditorProps) => {
  //   const potentialValues is shape[property.label];
  let valueShape = property.valueShape;
  let shapeClass = getShapeClass(shape.namedNode);
  let [bool, setBool] = useState(false);
  let forceUpdate = () => setBool(!bool);

  if (!valueShape) {
    console.log('No #valueshape defined in ' + property.uri);
    valueShape = Thing.shape;
  } else {
    console.log(property.label + ' uses #valueShape' + valueShape.label);
  }
  let values = (getShapeClass(valueShape.namedNode) as any).getLocalInstances();

  const onImageUploaded = async (dataUrl, format) => {
    try {
      const filename = generateRandomName(format);
      // create an ImageObject and save it
      const imageObj = await ImageObject.fromDataURL(dataUrl, filename);

      if (imageObj) {
        forceUpdate();
        of[property.label] = imageObj;
        imageObj.save();
      } else {
        console.error('Failed to create image object', imageObj);
      }
    } catch (err) {
      console.error('Error on uploading image:', err);
    }
  };

  return (
    <div className={style.Root}>
      <ImageUploader
        // thumbnailHeight={100}
        thumbnailWidth={thumbnailWidth}
        onUploaded={onImageUploaded}
        potentialValue={potentialValue}
      />
    </div>
  );
};

export default ImageValueEditor;
