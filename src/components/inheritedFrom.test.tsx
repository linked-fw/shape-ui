import {describe, expect, test} from '@jest/globals';
import {renderToStaticMarkup} from 'react-dom/server';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import {inheritedFromName} from '../shape/inheritance.js';
import AddInstanceForms from './AddInstanceForms.js';
import EditInstanceForms from './EditInstanceForms.js';

/**
 * A field the catalog marks `inheritedFrom` names its source shape under its label; an own
 * field carries no marker.
 */

const base = 'https://example.org/inherit-test/';
const xsdString = {id: 'http://www.w3.org/2001/XMLSchema#string'};
const literal = {id: 'http://www.w3.org/ns/shacl#Literal'};

const action = {
  id: `${base}shape/Action`,
  label: 'Action',
  targetClass: {id: `${base}vocab#Action`},
  propertyShapes: [],
} as unknown as NodeShapeWire;

const task = {
  id: `${base}shape/Task`,
  label: 'Task',
  targetClass: {id: `${base}vocab#Task`},
  extends: {id: action.id},
  propertyShapes: [
    {
      id: `${base}shape/Task/title`,
      label: 'title',
      path: {id: `${base}vocab#title`},
      nodeKind: literal,
      datatype: xsdString,
      minCount: 1,
      maxCount: 1,
    },
    {
      id: `${base}shape/Action/owner`,
      label: 'owner',
      path: {id: `${base}vocab#owner`},
      nodeKind: literal,
      datatype: xsdString,
      minCount: 1,
      maxCount: 1,
      inheritedFrom: {id: action.id},
    },
  ],
} as unknown as NodeShapeWire;

const allShapes = {[action.id]: action, [task.id]: task};

/** The text of each field row's label column, in order. */
function labels(html: string): string[] {
  return [...html.matchAll(/<div class="label">([\s\S]*?)<\/div>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  );
}

describe('inheritedFromName', () => {
  test('names the source shape by its label', () => {
    expect(inheritedFromName(task.propertyShapes[1], allShapes)).toBe('Action');
  });

  test('falls back to the last IRI segment when the shape is not in the map', () => {
    const property = {
      ...task.propertyShapes[1],
      inheritedFrom: {id: `${base}shape/BaseAction`},
    } as typeof task.propertyShapes[number];
    expect(inheritedFromName(property, {})).toBe('Base Action');
    expect(inheritedFromName(property)).toBe('Base Action');
  });

  test('is undefined for an own property and for a malformed mark', () => {
    expect(inheritedFromName(task.propertyShapes[0], allShapes)).toBeUndefined();
    const malformed = {...task.propertyShapes[0], inheritedFrom: {}} as typeof task.propertyShapes[number];
    expect(inheritedFromName(malformed, allShapes)).toBeUndefined();
  });
});

describe('the CMS forms mark inherited fields', () => {
  test('AddInstanceForms', () => {
    const html = renderToStaticMarkup(
      <AddInstanceForms
        shapeId={task.id}
        shape={task}
        allShapes={allShapes}
        onSave={async () => ({id: 'x'})}
        onComplete={() => {}}
      />,
    );
    expect(labels(html)).toEqual(['Title *', 'Owner * from Action']);
    expect(html).toContain('<span class="inheritedFrom" title="Inherited from Action">');
  });

  test('EditInstanceForms', () => {
    const html = renderToStaticMarkup(
      <EditInstanceForms
        shape={task}
        allShapes={allShapes}
        of={{id: `${base}data/1`, title: 'Plan', owner: 'Ann'}}
      />,
    );
    expect(labels(html)).toEqual(['Title *', 'Owner * from Action']);
  });

  test('without allShapes the marker still names the shape from its IRI', () => {
    const html = renderToStaticMarkup(
      <AddInstanceForms shapeId={task.id} shape={task} onComplete={() => {}} />,
    );
    expect(labels(html)).toEqual(['Title *', 'Owner * from Action']);
  });
});
