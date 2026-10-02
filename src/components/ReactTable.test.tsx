/**
 * @jest-environment jsdom
 */
import {afterEach, describe, expect, jest, test} from '@jest/globals';
import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import React from 'react';
import ReactTable, {type ReactTableProps} from './ReactTable.js';
import type {ShapeInstancesQueryConfig} from '../shape/contracts.js';

// The table's behaviour against react-table: client-side sorting, client-side and server-side
// (manual) pagination, one cell per column, and the row checkboxes that drive the selection the
// parent owns. Pinned down so that a react-table major cannot change what the user sees.

type Row = {id: string; name: string; age: number};

const columns: ReactTableProps['columns'] = [
  // InstanceOverview always puts a selection column first; its header is not sortable.
  {id: 'selection', header: 'Sel', cell: () => null},
  {id: 'name', header: 'Name', accessorFn: (row: any) => row.name, cell: (info) => info.getValue()},
  {id: 'age', header: 'Age', accessorFn: (row: any) => row.age, cell: (info) => String(info.getValue())},
];

function makeRows(n: number, offset = 0): Row[] {
  return Array.from({length: n}, (_, i) => ({
    id: `https://example.org/row/${offset + i}`,
    name: `name-${String(offset + i).padStart(3, '0')}`,
    age: offset + i,
  }));
}

const shape = {id: 'https://example.org/shape/Thing', label: 'Thing', propertyShapes: []} as any;

interface HarnessProps {
  data: Row[];
  totalCount?: number;
  initialConfig?: Partial<ShapeInstancesQueryConfig>;
  onConfig?: (c: ShapeInstancesQueryConfig) => void;
  selected?: Set<string>;
  toggleRowSelection?: (uri: string) => void;
}

function Harness({data, totalCount, initialConfig, onConfig, selected, toggleRowSelection}: HarnessProps) {
  const [config, setConfig] = React.useState<ShapeInstancesQueryConfig>({
    pageIndex: 0,
    pageSize: 10,
    filters: [],
    ...initialConfig,
  });
  const sel = selected ?? new Set<string>();
  return (
    <ReactTable
      data={data}
      totalCount={totalCount}
      columns={columns}
      toggleSelectAll={() => {}}
      isRowSelected={(uri) => sel.has(uri)}
      selectedUris={sel}
      toggleRowSelection={toggleRowSelection ?? (() => {})}
      clearSelection={() => {}}
      removeFromSelection={() => {}}
      hasSelection={sel.size > 0}
      shape={shape}
      config={config}
      setConfig={(c) => {
        onConfig?.(c);
        setConfig(c);
      }}
    />
  );
}

function bodyRows() {
  const tbody = document.querySelector('tbody')!;
  return Array.from(tbody.querySelectorAll('tr'));
}

/** The text of one column for every rendered body row. Column 0 is the row checkbox. */
function columnText(colIndex: number) {
  return bodyRows().map((tr) => tr.querySelectorAll('td')[colIndex]?.textContent ?? '');
}

function pageLabel() {
  return screen.getByText(/of/, {selector: 'strong'}).textContent?.replace(/\s+/g, ' ').trim();
}

function headerButton(label: string) {
  return screen.getByText(label, {selector: 'th div'});
}

afterEach(cleanup);

describe('ReactTable cells', () => {
  test('renders one cell per column, with the column cell renderer applied', () => {
    render(<Harness data={makeRows(3)} />);
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    // checkbox + 3 columns (selection, name, age) + actions
    expect(rows[0].querySelectorAll('td')).toHaveLength(5);
    expect(columnText(2)).toEqual(['name-000', 'name-001', 'name-002']);
    expect(columnText(3)).toEqual(['0', '1', '2']);
    const headers = Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headers[1]).toBe('Sel');
    expect(headers[2]).toContain('Name');
    expect(headers[3]).toContain('Age');
  });
});

describe('ReactTable sorting (client-side)', () => {
  const data: Row[] = [
    {id: 'u:b', name: 'banana', age: 30},
    {id: 'u:a', name: 'apple', age: 10},
    {id: 'u:c', name: 'cherry', age: 20},
  ];

  test('a text column sorts ascending first, then descending, then back to the data order', () => {
    render(<Harness data={data} />);
    expect(columnText(2)).toEqual(['banana', 'apple', 'cherry']);
    fireEvent.click(headerButton('Name'));
    expect(columnText(2)).toEqual(['apple', 'banana', 'cherry']);
    fireEvent.click(headerButton('Name'));
    expect(columnText(2)).toEqual(['cherry', 'banana', 'apple']);
    fireEvent.click(headerButton('Name'));
    expect(columnText(2)).toEqual(['banana', 'apple', 'cherry']);
  });

  test('a numeric column sorts descending first', () => {
    render(<Harness data={data} />);
    fireEvent.click(headerButton('Age'));
    expect(columnText(3)).toEqual(['30', '20', '10']);
    fireEvent.click(headerButton('Age'));
    expect(columnText(3)).toEqual(['10', '20', '30']);
  });

  test('text sorts case-insensitively and orders embedded numbers numerically', () => {
    // The auto-detected `alphanumeric` sort — a plain comparison would put "Item2" first
    // (uppercase sorts before lowercase) and "item10" before "item2". react-table 8 sampled
    // only rows 11 onwards to detect a column's type, so a table of ten rows or fewer got the
    // plain comparison; this pins the detection that now applies at every size.
    render(
      <Harness
        data={[
          {id: 'u:1', name: 'item10', age: 1},
          {id: 'u:2', name: 'Item2', age: 2},
          {id: 'u:3', name: 'item1', age: 3},
        ]}
      />,
    );
    fireEvent.click(headerButton('Name'));
    expect(columnText(2)).toEqual(['item1', 'Item2', 'item10']);
  });

  test('plain words sort case-insensitively', () => {
    render(
      <Harness
        data={[
          {id: 'u:1', name: 'beta', age: 1},
          {id: 'u:2', name: 'Gamma', age: 2},
          {id: 'u:3', name: 'alpha', age: 3},
        ]}
      />,
    );
    fireEvent.click(headerButton('Name'));
    expect(columnText(2)).toEqual(['alpha', 'beta', 'Gamma']);
  });

  test('sorting one column replaces the sort on another', () => {
    render(<Harness data={data} />);
    fireEvent.click(headerButton('Name'));
    fireEvent.click(headerButton('Age'));
    expect(columnText(3)).toEqual(['30', '20', '10']);
  });

  test('the selection column header is not a sort control', () => {
    render(<Harness data={data} />);
    fireEvent.click(screen.getByText('Sel'));
    expect(columnText(2)).toEqual(['banana', 'apple', 'cherry']);
  });
});

describe('ReactTable pagination (client-side, no totalCount)', () => {
  test('slices the whole dataset into pages', () => {
    render(<Harness data={makeRows(25)} />);
    expect(bodyRows()).toHaveLength(10);
    expect(pageLabel()).toBe('1 of 3');
    expect(screen.getByLabelText('Previous page')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('First page')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Next page')).toHaveProperty('disabled', false);
  });

  test('next / last / previous / first move through the pages', () => {
    const onConfig = jest.fn<(c: ShapeInstancesQueryConfig) => void>();
    render(<Harness data={makeRows(25)} onConfig={onConfig} />);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onConfig).toHaveBeenLastCalledWith(expect.objectContaining({pageIndex: 1, pageSize: 10}));
    expect(pageLabel()).toBe('2 of 3');
    expect(columnText(2)[0]).toBe('name-010');

    fireEvent.click(screen.getByLabelText('Last page'));
    expect(pageLabel()).toBe('3 of 3');
    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByLabelText('Next page')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Last page')).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(pageLabel()).toBe('2 of 3');

    fireEvent.click(screen.getByLabelText('First page'));
    expect(pageLabel()).toBe('1 of 3');
    expect(columnText(2)[0]).toBe('name-000');
  });

  test('the go-to-page input sets the page index', () => {
    render(<Harness data={makeRows(25)} />);
    const input = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.value).toBe('1');
    fireEvent.change(input, {target: {value: '3'}});
    expect(pageLabel()).toBe('3 of 3');
    expect(input.value).toBe('3');
  });

  test('the config the parent passes is the pagination state', () => {
    render(<Harness data={makeRows(25)} initialConfig={{pageIndex: 2, pageSize: 20}} />);
    expect(pageLabel()).toBe('3 of 2');
    // pageSize 20 over 25 rows: two pages; an out-of-range index renders no rows rather than
    // being silently clamped.
    expect(bodyRows()).toHaveLength(0);
  });

  test('preserves the other config fields when paging', () => {
    const onConfig = jest.fn<(c: ShapeInstancesQueryConfig) => void>();
    render(
      <Harness
        data={makeRows(25)}
        initialConfig={{orderBy: 'name', filters: ['f']}}
        onConfig={onConfig}
      />,
    );
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onConfig).toHaveBeenLastCalledWith({pageIndex: 1, pageSize: 10, orderBy: 'name', filters: ['f']});
  });
});

describe('ReactTable pagination (server-side, with totalCount)', () => {
  test('derives the page count from totalCount and does not re-slice the server page', () => {
    render(<Harness data={makeRows(10)} totalCount={45} />);
    expect(pageLabel()).toBe('1 of 5');
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByLabelText('Next page')).toHaveProperty('disabled', false);
  });

  test('on a later page, all rows of the fetched page are shown', () => {
    // The data is page 3 as the server cut it; slicing it again at pageIndex 2 would be empty.
    render(<Harness data={makeRows(10, 20)} totalCount={45} initialConfig={{pageIndex: 2}} />);
    expect(pageLabel()).toBe('3 of 5');
    expect(bodyRows()).toHaveLength(10);
    expect(columnText(2)[0]).toBe('name-020');
  });

  test('next asks the parent for the next page; last page disables next', () => {
    const onConfig = jest.fn<(c: ShapeInstancesQueryConfig) => void>();
    render(<Harness data={makeRows(10)} totalCount={45} onConfig={onConfig} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onConfig).toHaveBeenLastCalledWith(expect.objectContaining({pageIndex: 1, pageSize: 10}));
    fireEvent.click(screen.getByLabelText('Last page'));
    expect(onConfig).toHaveBeenLastCalledWith(expect.objectContaining({pageIndex: 4}));
    expect(pageLabel()).toBe('5 of 5');
    expect(screen.getByLabelText('Next page')).toHaveProperty('disabled', true);
  });

  test('new data does not echo an identical pagination update back to the parent', () => {
    // A no-op update reaching the parent would change its config object and re-trigger the
    // fetch — an infinite refetch loop.
    const onConfig = jest.fn<(c: ShapeInstancesQueryConfig) => void>();
    const {rerender} = render(<Harness data={makeRows(10)} totalCount={45} onConfig={onConfig} />);
    for (let i = 0; i < 3; i++) {
      rerender(<Harness data={makeRows(10, i * 10)} totalCount={45 + i} onConfig={onConfig} />);
    }
    expect(onConfig).not.toHaveBeenCalled();
  });
});

describe('ReactTable row selection', () => {
  test('a row checkbox toggles that row by its id', () => {
    const toggle = jest.fn<(uri: string) => void>();
    const data = makeRows(3);
    render(<Harness data={data} toggleRowSelection={toggle} />);
    const box = within(bodyRows()[1]).getByRole('checkbox');
    act(() => {
      fireEvent.click(box);
    });
    expect(toggle).toHaveBeenCalledWith(data[1].id);
  });

  test('the checkbox reflects the selection the parent owns', () => {
    const data = makeRows(3);
    render(<Harness data={data} selected={new Set([data[2].id])} />);
    const states = bodyRows().map((tr) => within(tr).getByRole('checkbox').getAttribute('aria-checked'));
    expect(states).toEqual(['false', 'false', 'true']);
  });

  test('selection follows the row through a sort', () => {
    const toggle = jest.fn<(uri: string) => void>();
    const data: Row[] = [
      {id: 'u:b', name: 'banana', age: 30},
      {id: 'u:a', name: 'apple', age: 10},
    ];
    render(<Harness data={data} toggleRowSelection={toggle} selected={new Set(['u:a'])} />);
    fireEvent.click(headerButton('Name'));
    const first = bodyRows()[0];
    expect(within(first).getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(bodyRows()[1]).getByRole('checkbox'));
    expect(toggle).toHaveBeenCalledWith('u:b');
  });
});
