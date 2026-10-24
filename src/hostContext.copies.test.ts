/**
 * @jest-environment jsdom
 */
import {afterAll, afterEach, beforeAll, describe, expect, jest, test} from '@jest/globals';
import * as React from 'react';
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import type {DataManagerHost} from './host.js';
import * as first from './hostContext.js';

/**
 * Two copies of this module in one runtime, as Vite's SSR runner next to Node or two browser
 * bundles produce. A provider from one copy must reach the hooks of the other: the contexts are
 * kept in core's `sharedState`, so both copies hold the same context objects.
 *
 * The second copy is evaluated in an isolated module registry, with React pinned to the first
 * copy's: the contexts can only be shared while both copies use one React.
 */

type HostContextModule = typeof import('./hostContext.js');

async function secondCopy(): Promise<HostContextModule> {
  let copy: HostContextModule | undefined;
  await jest.isolateModulesAsync(async () => {
    jest.unstable_mockModule('react', () => ({...React, default: React}));
    copy = await import('./hostContext.js');
  });
  if (!copy) throw new Error('second copy did not load');
  return copy;
}

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

// The isolated registry evaluates core a second time too, and core says so on console.error.
// That copy is the point of the test; anything else is still logged.
const consoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes("copies of @_linked/core's shape registry")) return;
    consoleError(...args);
  });
});
afterAll(() => jest.restoreAllMocks());

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
});

function render(element: React.ReactElement) {
  const container = document.createElement('div');
  root = createRoot(container);
  act(() => root!.render(element));
}

describe('two copies of hostContext', () => {
  test('the second copy is a separate evaluation of the module', async () => {
    const second = await secondCopy();
    expect(second.useDataManagerHost).not.toBe(first.useDataManagerHost);
    expect(second.DataManagerHostProvider).not.toBe(first.DataManagerHostProvider);
  });

  test("a consumer from one copy sees the other copy's provider", async () => {
    const second = await secondCopy();
    const host: DataManagerHost = {
      dataRoot: 'https://example.org/data/',
      resolveShape: async () => undefined,
    };
    const seen: {dataRoot?: string; catalog?: string} = {};

    function Consumer() {
      seen.dataRoot = second.useDataManagerHost().dataRoot;
      seen.catalog = second.useHostCatalogState().status;
      return null;
    }

    render(createElement(first.DataManagerHostProvider, {host}, createElement(Consumer)));

    // Without a shared context the consumer would get `nullHost()`, which has no dataRoot.
    expect(seen.dataRoot).toBe('https://example.org/data/');
    expect(seen.catalog).toBe('none');
  });

  test('the contexts live under Symbol.for("@_linked/shape-ui:contexts")', () => {
    const shared = (globalThis as unknown as Record<symbol, Record<string, unknown>>)[
      Symbol.for('@_linked/shape-ui:contexts')
    ];
    expect(Object.keys(shared).sort()).toEqual([
      'CatalogContext',
      'HostContext',
      'ShapeCatalogContext',
    ]);
  });
});
