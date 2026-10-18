/**
 * @jest-environment jsdom
 */
import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import type {ShapeCatalog} from '@_linked/core/utils/ShapeCatalog';
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {DataManagerHost} from './host.js';

/**
 * The host's catalog reaching the defaults.
 *
 * A host with `resolveShapeCatalog` has every default built in its catalog and nothing
 * registered in core's global registry; a host without it keeps registering the shape it
 * resolves. The query functions are mocked: what is asserted is which catalog they are handed.
 * `catalog.test.ts` covers what they do with it.
 */

const registerRuntimeShapes = jest.fn();
const searchInstancesWithDsl = jest.fn(async (..._args: unknown[]) => ({
  results: [] as {id: string; label: string}[],
  hasMore: false,
}));
const createInstanceWithDsl = jest.fn(async (..._args: unknown[]) => ({id: 'urn:new'}));
const updateInstanceWithDsl = jest.fn(async (..._args: unknown[]) => undefined);

jest.unstable_mockModule('@_linked/core/shapes/registerRuntimeShape', () => ({
  registerRuntimeShapes,
}));
jest.unstable_mockModule('./search', () => ({
  searchInstancesWithDsl,
  narrowSuggestions: (results: unknown) => results,
}));
jest.unstable_mockModule('./write', () => ({
  createInstanceWithDsl,
  updateInstanceWithDsl,
}));

const {DataManagerHostProvider, useDataManagerHost, useHostCatalogState, useHostShapeCatalog} =
  await import('./hostContext.js');

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const shape = {
  id: 'https://example.org/shape/Contact',
  label: 'Contact',
  propertyShapes: [{id: 'p1', label: 'name', path: {id: 'https://example.org/vocab#name'}}],
} as unknown as NodeShapeWire;

/** Any object will do: the query functions are mocked. */
const catalog = {name: 'test#main'} as unknown as ShapeCatalog;

let root: Root | undefined;
let container: HTMLElement | undefined;
let seen: {
  host?: DataManagerHost;
  catalog?: ShapeCatalog;
  wires?: ReturnType<typeof useHostCatalogState>;
} = {};

function Probe() {
  seen = {
    host: useDataManagerHost(),
    catalog: useHostShapeCatalog(),
    wires: useHostCatalogState(),
  };
  return null;
}

async function mount(host: DataManagerHost): Promise<DataManagerHost> {
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(DataManagerHostProvider, {host}, createElement(Probe)));
  });
  return seen.host!;
}

beforeEach(() => {
  jest.clearAllMocks();
  seen = {};
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
});

describe('a host with resolveShapeCatalog', () => {
  const scopedHost = (resolveShapeCatalog: () => Promise<ShapeCatalog>): DataManagerHost => ({
    dataRoot: 'https://example.org/data',
    resolveShape: async (iri) => (iri === shape.id ? shape : undefined),
    resolveShapeCatalog,
  });

  test('hands its catalog to every default and registers nothing', async () => {
    const resolveShapeCatalog = jest.fn(async () => catalog);
    const host = await mount(scopedHost(resolveShapeCatalog));
    expect(seen.catalog).toBe(catalog);

    await host.searchInstances!(shape.id, {query: 'an'});
    await host.createInstance!(shape.id, {name: 'Ann'});
    await host.updateInstance!(shape.id, 'urn:ann', {name: 'Bo'});
    await host.resolveShape(shape.id);

    expect(searchInstancesWithDsl).toHaveBeenCalledWith(shape, {query: 'an'}, {catalog});
    expect(createInstanceWithDsl).toHaveBeenCalledWith(
      shape,
      {name: 'Ann'},
      {dataRoot: 'https://example.org/data', catalog},
    );
    expect(updateInstanceWithDsl).toHaveBeenCalledWith(shape, 'urn:ann', {name: 'Bo'}, {catalog});
    expect(registerRuntimeShapes).not.toHaveBeenCalled();
    // Once per host object, however many queries.
    expect(resolveShapeCatalog).toHaveBeenCalledTimes(1);
  });

  test('a call made while the catalog loads waits for it', async () => {
    let resolve!: (c: ShapeCatalog) => void;
    const resolveShapeCatalog = jest.fn(
      () => new Promise<ShapeCatalog>((r) => (resolve = r)),
    );
    const host = await mount(scopedHost(resolveShapeCatalog));
    expect(seen.catalog).toBeUndefined();

    const search = host.searchInstances!(shape.id, {});
    await act(async () => resolve(catalog));
    await search;

    expect(searchInstancesWithDsl).toHaveBeenCalledWith(shape, {}, {catalog});
    expect(seen.catalog).toBe(catalog);
    expect(resolveShapeCatalog).toHaveBeenCalledTimes(1);
  });

  test('a failed load rejects and never falls back to registration', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const resolveShapeCatalog = jest.fn(async (): Promise<ShapeCatalog> => {
      throw new Error('catalog unavailable');
    });
    const host = await mount(scopedHost(resolveShapeCatalog));

    await expect(host.searchInstances!(shape.id, {})).rejects.toThrow('catalog unavailable');
    await expect(host.createInstance!(shape.id, {name: 'Ann'})).rejects.toThrow(
      'catalog unavailable',
    );
    expect(searchInstancesWithDsl).not.toHaveBeenCalled();
    expect(createInstanceWithDsl).not.toHaveBeenCalled();
    expect(registerRuntimeShapes).not.toHaveBeenCalled();
    expect(seen.catalog).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('resolveShapeCatalog() rejected'),
      expect.any(Error),
    );
    error.mockRestore();
  });
});

describe('a host without resolveShapeCatalog', () => {
  test('registers the shape it resolves and passes no catalog', async () => {
    const host = await mount({
      dataRoot: 'https://example.org/data',
      resolveShape: async (iri) => (iri === shape.id ? shape : undefined),
    });
    expect(seen.catalog).toBeUndefined();

    await host.searchInstances!(shape.id, {});
    await host.createInstance!(shape.id, {name: 'Ann'});
    await host.updateInstance!(shape.id, 'urn:ann', {name: 'Bo'});

    expect(registerRuntimeShapes).toHaveBeenCalledWith([shape]);
    expect(searchInstancesWithDsl).toHaveBeenCalledWith(shape, {}, {});
    expect(createInstanceWithDsl).toHaveBeenCalledWith(
      shape,
      {name: 'Ann'},
      {dataRoot: 'https://example.org/data'},
    );
    expect(updateInstanceWithDsl).toHaveBeenCalledWith(shape, 'urn:ann', {name: 'Bo'}, {});
  });
});

describe('the wire catalog (resolveCatalog), loaded the same way', () => {
  test('loads once and lists its shapes', async () => {
    const resolveCatalog = jest.fn(async () => ({[shape.id]: shape}));
    await mount({resolveShape: async () => undefined, resolveCatalog});
    expect(seen.wires).toEqual({status: 'loaded', shapes: [shape]});
    expect(resolveCatalog).toHaveBeenCalledTimes(1);
  });

  test('a rejection is failed with retry(), and retry() asks again', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = true;
    const resolveCatalog = jest.fn(async () => {
      if (fail) throw new Error('down');
      return {[shape.id]: shape};
    });
    await mount({resolveShape: async () => undefined, resolveCatalog});
    expect(seen.wires?.status).toBe('failed');

    fail = false;
    const state = seen.wires as {status: 'failed'; retry: () => void};
    await act(async () => state.retry());
    expect(seen.wires).toEqual({status: 'loaded', shapes: [shape]});
    expect(resolveCatalog).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});
