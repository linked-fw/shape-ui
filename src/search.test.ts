import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';

/**
 * The DSL default for relation-field search.
 *
 * Two things are worth pinning: it names **no project** (that is the portability claim),
 * and it derives the label from `labelProperty()` — the same rule the table uses, so a row
 * and a picker chip cannot disagree about what identifies an instance.
 *
 * The builder is mocked; what matters is the shape of the call, not the SPARQL, which
 * core's own suite covers.
 */

const fromMock = jest.fn();
const selectMock = jest.fn();
const whereMock = jest.fn();
const directMock = jest.fn();
const someMock = jest.fn();
const limitMock = jest.fn();
const offsetMock = jest.fn();
const execMock = jest.fn<() => Promise<Record<string, unknown>[]>>();

jest.unstable_mockModule('@_linked/core/queries/QueryBuilder', () => ({
  // Core's own modules import this name from the same module; they are loaded, not used.
  QueryBuilder: class {},
  SelectBuilder: {
    from: (...args: unknown[]) => {
      fromMock(...args);
      const builder: Record<string, unknown> = {};
      builder.select = (fn: (i: Record<string, unknown>) => unknown) => {
        const read: string[] = [];
        fn(new Proxy({}, {get: (_t, key) => (read.push(String(key)), key)}));
        selectMock(read);
        return builder;
      };
      builder.where = (fn: (i: unknown) => unknown) => {
        // Mirrors the DSL: a single-valued accessor has `.contains()`, a multi-valued
        // one is a set with `.some()` and no `.contains()`.
        const value = {contains: (v: unknown) => (whereMock(v), true)};
        fn(
          new Proxy(
            {},
            {
              get: () => ({
                contains: (v: unknown) => (directMock(v), whereMock(v), true),
                some: (cb: (v: typeof value) => unknown) => (
                  someMock(), cb(value)
                ),
              }),
            },
          ),
        );
        return builder;
      };
      builder.limit = (n: number) => (limitMock(n), builder);
      builder.offset = (n: number) => (offsetMock(n), builder);
      builder.exec = execMock;
      return builder;
    },
  },
}));

const {searchInstancesWithDsl, narrowSuggestions} = await import('./search.js');

const base = 'https://example.org/';

const shape = (props: Record<string, unknown>[]): NodeShapeWire =>
  ({
    id: `${base}shape/Person`,
    label: 'Person',
    targetClass: {id: `${base}vocab#Person`},
    propertyShapes: props,
  }) as NodeShapeWire;

const prop = (label: string, extra: Record<string, unknown> = {}) => ({
  id: `${base}shape/Person/${label}`,
  label,
  path: {id: `${base}vocab#${label}`},
  ...extra,
});

const rows = (n: number, labelKey = 'name') =>
  Array.from({length: n}, (_, i) => ({id: `urn:${i}`, [labelKey]: `Person ${i}`}));

beforeEach(() => {
  jest.clearAllMocks();
  execMock.mockResolvedValue(rows(3));
});

describe('searchInstancesWithDsl', () => {
  test('queries by shape IRI and names no project', async () => {
    await searchInstancesWithDsl(shape([prop('name')]));
    expect(fromMock).toHaveBeenCalledWith(`${base}shape/Person`);
    expect(fromMock.mock.calls[0]).toHaveLength(1);
  });

  test('projects the label property the table would use', async () => {
    await searchInstancesWithDsl(
      shape([prop('sku'), prop('name', {displayRank: 1})]),
    );
    expect(selectMock).toHaveBeenCalledWith(['name']);
  });

  test('a text query filters on the label', async () => {
    await searchInstancesWithDsl(shape([prop('name')]), {query: 'ada'});
    expect(whereMock).toHaveBeenCalledWith('ada');
  });

  test('a multi-valued label (no maxCount) filters through .some without throwing', async () => {
    await expect(
      searchInstancesWithDsl(shape([prop('name')]), {query: 'ada'}),
    ).resolves.toBeDefined();
    expect(whereMock).toHaveBeenCalledWith('ada');
    expect(someMock).toHaveBeenCalled();
    expect(directMock).not.toHaveBeenCalled();
  });

  test('a single-valued label (maxCount 1) filters with .contains directly', async () => {
    await searchInstancesWithDsl(shape([prop('name', {maxCount: 1})]), {query: 'ada'});
    expect(directMock).toHaveBeenCalledWith('ada');
    expect(someMock).not.toHaveBeenCalled();
  });

  test('an empty or whitespace query browses rather than filtering', async () => {
    await searchInstancesWithDsl(shape([prop('name')]), {query: '   '});
    expect(whereMock).not.toHaveBeenCalled();
  });

  test('asks for one more than the page, to answer hasMore without a COUNT', async () => {
    execMock.mockResolvedValue(rows(21));
    const result = await searchInstancesWithDsl(shape([prop('name')]), {limit: 20});
    expect(limitMock).toHaveBeenCalledWith(21);
    expect(result.results).toHaveLength(20);
    expect(result.hasMore).toBe(true);
  });

  test('hasMore is false when the probe comes back short', async () => {
    execMock.mockResolvedValue(rows(5));
    const result = await searchInstancesWithDsl(shape([prop('name')]), {limit: 20});
    expect(result.hasMore).toBe(false);
    expect(result.results).toHaveLength(5);
  });

  test('offset is passed only when non-zero', async () => {
    await searchInstancesWithDsl(shape([prop('name')]), {offset: 0});
    expect(offsetMock).not.toHaveBeenCalled();
    await searchInstancesWithDsl(shape([prop('name')]), {offset: 40});
    expect(offsetMock).toHaveBeenCalledWith(40);
  });

  test('falls back to the IRI when a shape has no showable label', async () => {
    // A modelling gap, not a crash: showing the id at least lets someone recognise the row.
    execMock.mockResolvedValue([{id: 'urn:7'}]);
    const result = await searchInstancesWithDsl(
      shape([prop('author', {valueShape: {id: `${base}shape/Person`}})]),
    );
    expect(result.results[0]).toEqual({id: 'urn:7', label: 'urn:7'});
  });

  test('a text query on a shape with no label does not filter everything out', async () => {
    execMock.mockResolvedValue([{id: 'urn:7'}]);
    const result = await searchInstancesWithDsl(
      shape([prop('author', {valueShape: {id: `${base}shape/Person`}})]),
      {query: 'ada'},
    );
    expect(whereMock).not.toHaveBeenCalled();
    expect(result.results).toHaveLength(1);
  });

  test('reads a label out of a node reference, not just a string', async () => {
    execMock.mockResolvedValue([{id: 'urn:1', name: {id: 'urn:x', label: 'Ada'}}]);
    const result = await searchInstancesWithDsl(shape([prop('name')]));
    expect(result.results[0].label).toBe('Ada');
  });

  test('survives a query that returns nothing', async () => {
    execMock.mockResolvedValue(undefined as never);
    const result = await searchInstancesWithDsl(shape([prop('name')]));
    expect(result).toEqual({results: [], hasMore: false});
  });
});

describe('narrowSuggestions', () => {
  const suggestions = [
    {id: 'a', label: 'A'},
    {id: 'b', label: 'B'},
  ];

  test('passes everything through when there is no narrowing', () => {
    expect(narrowSuggestions(suggestions)).toEqual(suggestions);
    expect(narrowSuggestions(suggestions, [])).toEqual(suggestions);
    expect(narrowSuggestions(suggestions, null)).toEqual(suggestions);
  });

  test('keeps only the allowed ids', () => {
    expect(narrowSuggestions(suggestions, ['b'])).toEqual([{id: 'b', label: 'B'}]);
  });
});
