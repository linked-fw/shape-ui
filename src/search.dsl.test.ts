import {beforeAll, describe, expect, test} from '@jest/globals';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import type {IDataset} from '@_linked/core/interfaces/IDataset';
import {LinkedStorage} from '@_linked/core/utils/LinkedStorage';
import {ShapeCatalog} from '@_linked/core/utils/ShapeCatalog';
import {lower} from '@_linked/core/queries/lower';
import {unsupportedGraphQuery} from '@_linked/core/queries/graphQuery';
import {readKindOf, type ReadQuery, type ReadResult} from '@_linked/core/queries/readQuery';
import {selectToSparql} from '@_linked/core/sparql/irToAlgebra';
import {searchInstancesWithDsl} from './search.js';

/**
 * The search filter with core's real builders, not the mocked builder of search.test.ts.
 *
 * That mock once modelled a multi-valued label as a set with `.some()`, and search
 * filtered with `.some()` to match it. Core never had that: in a `where`, a literal path
 * is a query primitive whether or not the property is multi-valued, a multi-valued
 * literal has no `.some()`, and a filter on it holds when any of its values matches. So
 * the search threw `.some is not a function` on every dataset as soon as a label had no
 * `maxCount: 1`. These run the real builder and lower the query to SPARQL, as a store
 * does.
 */

const base = 'https://example.org/search-dsl-test/';
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';

const shapeWithLabel = (name: string, maxCount?: number): NodeShapeWire =>
  ({
    id: `${base}shape/${name}`,
    label: name,
    targetClass: {id: `${base}vocab#${name}`},
    propertyShapes: [
      {
        id: `${base}shape/${name}/name`,
        label: 'name',
        path: {id: `${base}vocab#name`},
        datatype: {id: XSD_STRING},
        ...(maxCount === undefined ? {} : {maxCount}),
      },
    ],
  }) as unknown as NodeShapeWire;

/** A label with no `maxCount`: multi-valued, as in the report that surfaced this. */
const multi = shapeWithLabel('Tag');
/** The control: the same label with `maxCount: 1`. */
const single = shapeWithLabel('Contact', 1);
const catalog = ShapeCatalog.from([multi, single], {name: 'search-dsl-test#main'});

const sparql: string[] = [];
const dataset: IDataset = {
  supports: ['ask'],
  async readQuery<Q extends ReadQuery>(query: Q): Promise<ReadResult<Q>> {
    if (readKindOf(query) !== 'select')
      throw new Error(`This test double answers selects only, not a ${readKindOf(query)} read.`);
    // Lowered and compiled here, outside the catalog scope, where a real store does it.
    sparql.push(selectToSparql(lower(query as any) as any));
    return [] as ReadResult<Q>;
  },
  async createQuery() {
    throw new Error('not used');
  },
  async updateQuery() {
    throw new Error('not used');
  },
  async deleteQuery() {
    throw new Error('not used');
  },
  async graphQuery(query) {
    throw unsupportedGraphQuery(query);
  },
};

beforeAll(() => {
  LinkedStorage.setDefaultDataset(dataset);
});

async function searchSparql(shape: NodeShapeWire, query: string): Promise<string> {
  sparql.length = 0;
  await searchInstancesWithDsl(shape, {query, limit: 3}, {catalog});
  expect(sparql).toHaveLength(1);
  return sparql[0];
}

describe('searchInstancesWithDsl, built and lowered by core', () => {
  test('a multi-valued label (no maxCount) is searched, matching any of its values', async () => {
    const text = await searchSparql(multi, 'ada');
    // The filter is on the variable the label's own triple binds, so it holds when any of
    // the instance's values contains the query.
    const bound = text.match(new RegExp(`<${base}vocab#name> (\\?\\w+)`))?.[1];
    expect(bound).toBeDefined();
    expect(text).toContain(`FILTER(CONTAINS(${bound}, "ada"))`);
  });

  test('the control: a single-valued label (maxCount 1) is searched the same way', async () => {
    const text = await searchSparql(single, 'ada');
    expect(text).toMatch(/FILTER\(CONTAINS\(\?\w+, "ada"\)\)/);
  });

  test('an empty query still browses without a filter', async () => {
    const text = await searchSparql(multi, '   ');
    expect(text).not.toContain('CONTAINS');
  });
});
