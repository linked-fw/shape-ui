import {beforeAll, describe, expect, test} from '@jest/globals';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import type {IDataset} from '@_linked/core/interfaces/IDataset';
import {LinkedStorage} from '@_linked/core/utils/LinkedStorage';
import {getNodeShape} from '@_linked/core/utils/ShapeClass';
import {
  ShapeCatalog,
  catalogOf,
  getActiveShapeCatalog,
} from '@_linked/core/utils/ShapeCatalog';
import {lower} from '@_linked/core/queries/lower';
import {
  createToSparql,
  selectToSparql,
  updateToSparql,
} from '@_linked/core/sparql/irToAlgebra';
import {selectInstance, selectInstances} from './read.js';
import {searchInstancesWithDsl} from './search.js';
import {createInstanceWithDsl, updateInstanceWithDsl} from './write.js';

/**
 * The query functions against a host's catalog, with core's real builders.
 *
 * The shape is in the catalog and never in core's global registry, so a query can only
 * resolve it through the catalog. The dataset records what reached it and compiles it to
 * SPARQL there — after the scope has closed, which is when a real store compiles it too.
 */

const base = 'https://example.org/catalog-test/';

const shape: NodeShapeWire = {
  id: `${base}shape/Contact`,
  label: 'Contact',
  targetClass: {id: `${base}vocab#Contact`},
  propertyShapes: [
    {
      id: `${base}shape/Contact/name`,
      label: 'name',
      path: {id: `${base}vocab#name`},
      datatype: {id: 'http://www.w3.org/2001/XMLSchema#string'},
      maxCount: 1,
    },
  ],
} as unknown as NodeShapeWire;

const catalog = ShapeCatalog.from([shape], {name: 'test#main'});

interface Seen {
  kind: string;
  captured: ShapeCatalog | undefined;
  active: ShapeCatalog | undefined;
  sparql: string;
}
const seen: Seen[] = [];

const dataset: IDataset = {
  async selectQuery(query: any) {
    seen.push({
      kind: 'select',
      captured: catalogOf(query),
      active: getActiveShapeCatalog(),
      sparql: selectToSparql(lower(query) as any),
    });
    return [] as any;
  },
  async askQuery() {
    return false;
  },
  async createQuery(query: any) {
    seen.push({
      kind: 'create',
      captured: catalogOf(query),
      active: getActiveShapeCatalog(),
      sparql: createToSparql(lower(query) as any),
    });
    return {id: 'x'} as any;
  },
  async updateQuery(query: any) {
    seen.push({
      kind: 'update',
      captured: catalogOf(query),
      active: getActiveShapeCatalog(),
      sparql: updateToSparql(lower(query) as any),
    });
    return {} as any;
  },
  async deleteQuery() {
    return {deleted: [], count: 0} as any;
  },
} as unknown as IDataset;

beforeAll(() => {
  LinkedStorage.setDefaultDataset(dataset);
});

/** The one query the call sent, checked against the catalog. */
async function only(run: () => Promise<unknown>): Promise<Seen> {
  seen.length = 0;
  await run();
  expect(seen).toHaveLength(1);
  const [query] = seen;
  expect(query.captured).toBe(catalog);
  // Core calls the dataset outside the catalog; the builder carries it.
  expect(query.active).toBeUndefined();
  expect(query.sparql).toContain(`${base}vocab#name`);
  return query;
}

describe('with a catalog, a shape absent from the global registry', () => {
  test('is not registered', () => {
    expect(getNodeShape(shape.id)).toBeUndefined();
  });

  test('selectInstances builds against it', async () => {
    const query = await only(() => selectInstances(shape, {limit: 5}, {catalog}));
    expect(query.sparql).toContain(`${base}vocab#Contact`);
    expect(query.sparql).toMatch(/LIMIT 5/);
  });

  test('selectInstance builds against it', async () => {
    const query = await only(() =>
      selectInstance(shape, `${base}data/ann`, {}, {catalog}),
    );
    expect(query.sparql).toContain(`${base}data/ann`);
  });

  test('searchInstancesWithDsl builds against it', async () => {
    const query = await only(() =>
      searchInstancesWithDsl(shape, {query: 'an', limit: 3}, {catalog}),
    );
    expect(query.sparql).toMatch(/CONTAINS/i);
    expect(query.sparql).toMatch(/LIMIT 4/);
  });

  test('createInstanceWithDsl builds against it', async () => {
    const query = await only(() =>
      createInstanceWithDsl(shape, {name: 'Ann'}, {id: `${base}data/ann`, catalog}),
    );
    expect(query.sparql).toContain('Ann');
  });

  test('updateInstanceWithDsl builds against it', async () => {
    const query = await only(() =>
      updateInstanceWithDsl(shape, `${base}data/ann`, {name: 'Bo'}, {catalog}),
    );
    expect(query.sparql).toContain('Bo');
  });

  test('none of it registered the shape', () => {
    expect(getNodeShape(shape.id)).toBeUndefined();
  });
});

describe('without a catalog', () => {
  test('a shape that is not registered does not resolve', async () => {
    seen.length = 0;
    await expect(selectInstances(shape)).rejects.toThrow();
    expect(seen).toHaveLength(0);
  });
});
