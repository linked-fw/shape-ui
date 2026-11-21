import {describe, expect, test} from '@jest/globals';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ColumnDef} from '@tanstack/react-table';
import type {NodeShapeWire} from '@_linked/core/shapes/nodeShapeWire';
import ReactTable, {type ReactTableProps} from './ReactTable.js';

/**
 * An empty dataset shows a short message instead of the header row (with its select-all and
 * Actions), the rows and the pagination; the page label never reads "of 0".
 */

const shape = {
  id: 'https://example.org/shape/Article',
  label: 'Article',
  propertyShapes: [],
} as unknown as NodeShapeWire;

const columns: ColumnDef<any>[] = [{id: 'title', accessorFn: (row: any) => row.title, header: 'title'}];

const noop = () => undefined;

function render(overrides: Partial<ReactTableProps>): string {
  const props: ReactTableProps = {
    data: [],
    columns,
    shape,
    properties: {},
    toggleSelectAll: noop,
    isRowSelected: () => false,
    selectedUris: new Set<string>(),
    toggleRowSelection: noop,
    clearSelection: noop,
    removeFromSelection: noop,
    hasSelection: false,
    config: {pageIndex: 0, pageSize: 10, filters: []},
    setConfig: noop,
    ...overrides,
  };
  return renderToStaticMarkup(<ReactTable {...props} />);
}

/** The text of the page label ("Page 1 of 1"), or null when there is none. */
function pageLabel(html: string): string | null {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return text.match(/Page \d+ of \d+/)?.[0] ?? null;
}

describe('ReactTable with no rows', () => {
  test('an empty dataset shows a message, no header row, no Actions and no pagination', () => {
    const html = render({data: []});
    expect(html).toContain('No Article yet.');
    expect(html).not.toContain('<thead');
    expect(html).not.toContain('Actions');
    expect(pageLabel(html)).toBeNull();
  });

  test('a server-paged empty dataset (totalCount 0) is empty too', () => {
    const html = render({data: [], totalCount: 0});
    expect(html).toContain('No Article yet.');
    expect(html).not.toContain('<thead');
  });

  test('while loading, the table and its skeleton rows show, not the message', () => {
    const html = render({data: [], isLoading: true});
    expect(html).not.toContain('No Article yet.');
    expect(html).toContain('<thead');
  });

  test('with rows, the header row and the pagination show, counting at least one page', () => {
    const html = render({data: [{id: 'https://example.org/a/1', title: 'One'}]});
    expect(html).toContain('<thead');
    expect(pageLabel(html)).toBe('Page 1 of 1');
  });
});
