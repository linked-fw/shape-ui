import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ShapeInstancesQueryConfig } from '../shape/contracts.js';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@_linked/primitives/components/Button';
import { Checkbox } from '@_linked/primitives/components/Checkbox';
import { Drawer } from '@_linked/primitives/components/Drawer';
import { IconButton } from '@_linked/primitives/components/IconButton';
import { Input } from '@_linked/primitives/components/Input';
import { Label } from '@_linked/primitives/components/Label';
import { Select } from '@_linked/primitives/components/Select';
import { Typography } from '@_linked/primitives/components/Typography';
import type { PropertyShapeWire, NodeShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import { ShapeSet } from '@_linked/core/collections/ShapeSet';
import { cl } from '@_linked/react/utils/ClassNames';
import React from 'react';
import { getNodeDisplay, humanizeEnumLabel, enumOptions } from '../shape/nodeDisplay.js';
import { formatShapeLabel } from '../shape/naming.js';
import {
  tableStaggerContainer,
  tableRowItem,
  useReducedMotion,
} from '@_linked/primitives/motion';
import { Icons } from '@_linked/icons';
import { Spinner } from '@_linked/primitives/components/Spinner';
import {FilterBadge} from './FilterBadge.js';
import { TableRowSkeleton } from '@_linked/primitives/components/SkeletonLoader';
import { TruncatedText } from '@_linked/primitives/components/TruncatedText';
import {
  type TableFilter,
  applyAllFilters,
  generateFilterId,
  getOperatorsForProperty,
  formatFilterLabel,
  type FilterOperator,
} from '../shape/tableFilters.js';
import { getPropertyUiType } from '../shape/propertyTypes.js';
import { useDataManagerHost } from '../hostContext.js';
import type { TableMode } from '../columns.js';
import type { InstanceDeletionResult, InstanceDeletionTarget } from '../shape/contracts.js';
import type { BatchResult } from './InstanceOverview.js';
import BatchEditDrawer from './BatchEditDrawer.js';
import { InstanceDeletionDialog, type InstanceDeletionDialogProps } from './InstanceDeletionDialog.js';
import style from './ReactTable.module.css';

export interface ReactTableProps {
  data: any[] | ShapeSet<any>;
  /**
   * Total number of rows in the *whole* dataset, not just `data`.
   *
   * Omit it and `data` is the whole dataset: the table paginates it client-side, exactly as
   * it always has. Supply it and `data` is understood to be one server-fetched page — the
   * table switches to manual pagination and derives the page count, the page-range label and
   * the next/last disabled states from this number instead of from `data.length`.
   */
  totalCount?: number;
  columns: ColumnDef<any>[];
  toggleSelectAll: () => void;
  isRowSelected: (uri: string) => boolean;
  selectedUris: Set<string>;
  toggleRowSelection: (uri: string) => void;
  clearSelection: () => void;
  removeFromSelection: (uris: string[]) => void;
  hasSelection: boolean;
  shape: NodeShapeWire;
  properties?: Record<string, PropertyShapeWire>;
  isLoading?: boolean;
  config: ShapeInstancesQueryConfig;
  setConfig: (updated: ShapeInstancesQueryConfig) => void;
  isPickMode?: boolean;
  onPickInstance?: (instance: { id: string; label: string; image?: string }) => void;
  onPickInstances?: (instances: { id: string; label: string; image?: string }[]) => void;
  pickMaxCount?: number;
  pickAlreadySelected?: { id: string; label: string; image?: string }[];
  deletionProjectId?: string;
  previewDeletion?: InstanceDeletionDialogProps['previewDeletion'];
  executeDeletion?: InstanceDeletionDialogProps['executeDeletion'];
  onInstancesDeleted?: (uris: string[]) => void;
  onBatchUpdate?: (changes: Record<string, any>, uris: string[]) => Promise<BatchResult>;
  tableMode?: TableMode;
  onTableModeChange?: (mode: TableMode) => void;
}

function ReactTable({
  data,
  totalCount,
  columns,
  toggleSelectAll,
  isRowSelected,
  selectedUris,
  toggleRowSelection,
  clearSelection,
  removeFromSelection,
  hasSelection,
  shape,
  properties: propertiesMap,
  isLoading = false,
  config,
  setConfig,
  isPickMode = false,
  onPickInstance,
  onPickInstances,
  pickMaxCount,
  pickAlreadySelected,
  deletionProjectId,
  previewDeletion,
  executeDeletion,
  onInstancesDeleted,
  onBatchUpdate,
  tableMode,
  onTableModeChange,
}: ReactTableProps) {
  // ─── Filter state ──────────────────────────────────────────────────
  const [filters, setFilters] = React.useState<TableFilter[]>([]);
  const [selectedColumn, setSelectedColumn] = React.useState('');
  const [selectedOperator, setSelectedOperator] = React.useState<FilterOperator | ''>('');
  const [filterValue, setFilterValue] = React.useState('');
  const [enumSelections, setEnumSelections] = React.useState<string[]>([]);
  const reducedMotion = useReducedMotion();
  // Row actions go through the host. Building `${ROUTES.data.path}/…/edit?s0=…` here
  // assumed CN's URL layout; where "edit this row" leads is the host's decision.
  const host = useDataManagerHost();

  // Deletion needs THREE things, not one: somewhere to scope the impact query, a way to
  // preview the cascade, and a way to perform it. Gating the affordance on the project id
  // alone offered a Delete button whose dialog then called an undefined `previewDeletion`
  // — which is exactly what the overview page did, because it passed the id and neither
  // callback. An affordance that cannot complete should not be offered.
  const canDelete = Boolean(deletionProjectId && previewDeletion && executeDeletion);

  // ─── Batch operation state ─────────────────────────────────────────
  const [batchEditOpen, setBatchEditOpen] = React.useState(false);
  const [batchOperationPending, setBatchOperationPending] = React.useState(false);
  const [batchResult, setBatchResult] = React.useState<{ message: string; isError: boolean } | null>(null);

  // Build a map of column IDs to property details for filter type detection.
  const propertyMap = React.useMemo(() => {
    if (propertiesMap) return propertiesMap;
    const map: Record<string, PropertyShapeWire> = {};
    if (shape?.propertyShapes) {
      for (const prop of shape.propertyShapes) {
        map[prop.label] = prop as unknown as PropertyShapeWire;
      }
    }
    return map;
  }, [propertiesMap, shape?.propertyShapes]);

  // Get available operators when column changes
  const selectedProperty: PropertyShapeWire | null = selectedColumn ? propertyMap[selectedColumn] || null : null;
  const availableOperators = selectedProperty
    ? getOperatorsForProperty(selectedProperty)
    : [];
  const selectedUiType = selectedProperty ? getPropertyUiType(selectedProperty) : null;
  const isEnumColumn = selectedUiType === 'enum-literal' || selectedUiType === 'enum-iri';

  // Reset operator/value when column changes
  React.useEffect(() => {
    if (availableOperators.length > 0) {
      setSelectedOperator(availableOperators[0].value);
    } else {
      setSelectedOperator('');
    }
    setFilterValue('');
    setEnumSelections([]);
  }, [selectedColumn]);

  // Apply filters to data (client-side)
  const filteredData = React.useMemo(() => {
    const activeFilters = filters.filter((f) => f.isActive);
    if (activeFilters.length === 0) return data as any[];
    return (data as any[]).filter((row) => applyAllFilters(row, activeFilters));
  }, [data, filters]);

  const setPagination = (updater) => {
    // react-table passes a functional updater; resolve it against the current config.
    const newVal =
      typeof updater === 'function' ? updater(config) : updater;
    // Skip no-op pagination updates. react-table re-fires onPaginationChange whenever
    // the data changes; propagating an identical-but-new config object would change
    // `tableConfig` and re-trigger the parent's fetch effect — an infinite refetch loop.
    if (
      newVal &&
      newVal.pageIndex === config.pageIndex &&
      newVal.pageSize === config.pageSize
    ) {
      return;
    }
    setConfig(newVal);
  };

  const table = useReactTable({
    columns,
    data: filteredData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Client-side pagination only when we hold the whole dataset. With `totalCount` the rows
    // in `data` are already the page the server cut, so slicing them again would show one
    // page's worth of one page. `rowCount` left undefined makes react-table fall back to the
    // pre-pagination row count — i.e. the unchanged client-side behaviour.
    ...(totalCount === undefined
      ? { getPaginationRowModel: getPaginationRowModel() }
      : {}),
    manualPagination: totalCount !== undefined,
    rowCount: totalCount,
    onPaginationChange: setPagination,
    state: {
      pagination: config,
    },
  });

  // Compute whether we've hit the maxCount limit for pick mode
  const pickLimitReached = isPickMode && pickMaxCount != null && selectedUris.size >= pickMaxCount;

  const handleFilterSubmit = () => {
    if (!selectedColumn || !selectedOperator) return;
    const value = isEnumColumn && selectedOperator === 'in'
      ? enumSelections
      : filterValue.trim();
    if (Array.isArray(value) ? value.length === 0 : !value) return;

    const newFilter: TableFilter = {
      id: generateFilterId(),
      columnId: selectedColumn,
      columnLabel: selectedColumn
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, (c) => c.toUpperCase()),
      operator: selectedOperator,
      value,
      isActive: true,
    };
    setFilters([...filters, newFilter]);
    setFilterValue('');
    setEnumSelections([]);
  };

  const handleFilterToggle = (index: number) => {
    setFilters(filters.map((filter, i) =>
      i === index ? { ...filter, isActive: !filter.isActive } : filter
    ));
  };

  const handleFilterRemove = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const rowToPickInstance = (row) => {
    const original = row.original;
    const labelKey = Object.keys(original).find((k) => k !== 'id' && original[k]);
    const rawLabel = labelKey ? original[labelKey] : original.id;
    const label = typeof rawLabel === 'object' && rawLabel?.label
      ? rawLabel.label
      : typeof rawLabel === 'string'
        ? rawLabel
        : String(original.id || '');
    const image = original.image?.contentUrl || original.image;
    return {
      id: original.id,
      label,
      ...(typeof image === 'string' ? { image } : {}),
    };
  };

  const handlePick = (row) => {
    if (!onPickInstance) return;
    onPickInstance(rowToPickInstance(row));
  };

  const handlePickSelected = () => {
    const rows = table.getRowModel().rows;
    const picked = rows
      .filter((r) => selectedUris.has(r.original?.id))
      .map(rowToPickInstance);
    if (picked.length === 1 && onPickInstance) {
      onPickInstance(picked[0]);
    } else if (picked.length > 0 && onPickInstances) {
      onPickInstances(picked);
    } else if (picked.length > 0 && onPickInstance) {
      onPickInstance(picked[0]);
    }
  };

  const handleEdit = (row) => {
    // Single-instance edit: always `s0` (the edit page reads `s0`). `row.id` is
    // react-table's row index, not a query-subject index — using it produced
    // `?s1=` for later rows, which the edit page couldn't read ("Missing instance id").
    const subject = row.original.id;
    host.navigate?.toEdit(shape?.id, subject);
  };

  const handleView = (row) => {
    const subject = row.original.id;
    host.navigate?.toInstance(shape?.id, subject);
  };

  // ─── Preview-required instance deletion ────────────────────────────
  const [deletionTarget, setDeletionTarget] = React.useState<{
    kind: 'single' | 'batch';
    targets: InstanceDeletionTarget[];
    labels: Record<string, string>;
  } | null>(null);

  const handleDelete = (row: any) => {
    const uri = row.original?.id;
    const label = row.original?.label || row.original?.name || getNodeDisplay(row.original) || '';
    setDeletionTarget({
      kind: 'single',
      targets: [{ instanceId: uri, shapeIri: shape.id }],
      labels: { [uri]: label },
    });
  };

  // ─── Batch delete ──────────────────────────────────────────────────
  const handleDeleteCollectively = () => {
    if (!canDelete || selectedUris.size === 0) return;
    const uris = Array.from(selectedUris);
    const labels: Record<string, string> = {};
    for (const row of (data as any[])) {
      if (selectedUris.has(row?.id)) {
        labels[row.id] = row.label || row.name || getNodeDisplay(row) || row.id;
      }
    }
    setDeletionTarget({
      kind: 'batch',
      targets: uris.map((instanceId) => ({ instanceId, shapeIri: shape.id })),
      labels,
    });
  };

  const handleDeletionCompleted = (result: InstanceDeletionResult) => {
    if (!deletionTarget) return;
    const requested = deletionTarget.targets.map(({ instanceId }) => instanceId);
    const deleted = result.deleted.map(({ instanceId }) => instanceId);
    const deletedSet = new Set(deleted);
    const failed = requested.filter((uri) => !deletedSet.has(uri));
    onInstancesDeleted?.(deleted);
    if (deletionTarget.kind === 'batch') {
      if (failed.length > 0) {
        removeFromSelection(deleted);
        setBatchResult({
          message: `Deleted ${deleted.length} of ${requested.length}. ${failed.length} failed and remain selected.`,
          isError: true,
        });
      } else {
        clearSelection();
        setBatchResult({
          message: `Successfully deleted ${deleted.length} items.`,
          isError: false,
        });
      }
    }
  };

  // ─── Batch edit ────────────────────────────────────────────────────
  const handleBatchApply = async (changes: Record<string, any>) => {
    if (!onBatchUpdate) return;
    const uris = Array.from(selectedUris);
    setBatchOperationPending(true);
    setBatchResult(null);
    try {
      const result = await onBatchUpdate(changes, uris);
      setBatchEditOpen(false);
      if (result.failed.length > 0) {
        removeFromSelection(result.succeeded);
        setBatchResult({
          message: `Updated ${result.succeeded.length} of ${uris.length}. ${result.failed.length} failed.`,
          isError: true,
        });
      } else {
        clearSelection();
        setBatchResult({
          message: `Successfully updated ${result.succeeded.length} items.`,
          isError: false,
        });
      }
    } catch (err) {
      setBatchResult({
        message: `Batch update failed: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      });
    } finally {
      setBatchOperationPending(false);
    }
  };

  // Auto-clear result message after 5 seconds
  React.useEffect(() => {
    if (!batchResult) return;
    const timer = setTimeout(() => setBatchResult(null), 5000);
    return () => clearTimeout(timer);
  }, [batchResult]);

  const getCellStyle = (cell) => {
    const value = cell.getValue();
    if (value === 'Yes') {
      return style.green;
    }
    return '';
  };

  const renderCellContent = (cell) => {
    const value = cell.getValue();
    if (typeof value === 'string' && value.length > 80) {
      return <TruncatedText text={value} maxLength={50} />;
    }
    return flexRender(cell.column.columnDef.cell, cell.getContext());
  };

  const hasFilters = filters.length > 0;
  const selectionCount = selectedUris.size;

  return (
    <div className={style.tableWrapper}>
      {/* Action bar */}
      <div className={cl(style.action, !hasFilters && !hasSelection && style.withBorder)}>
        {/* A button, not a <Link>. An anchor would have to know the host's URL for
            "add one of these", and a host that has no such page (a picker-only embed)
            has no href to give. `toAdd` is the whole contract. */}
        <Button
          size="small"
          onClick={() => shape?.id && host.navigate?.toAdd(shape.id)}
          disabled={!shape?.id || !host.navigate}
        >
          <Icons.UserPlus width={18} height={18} />
          New {shape ? formatShapeLabel(shape.label) : ''}
        </Button>
        <Drawer.Root direction="right" handleOnly>
          <Drawer.Trigger asChild>
            <IconButton size="small" variant="outline" aria-label="Open filters">
              <Icons.ListFilter width={20} height={20} />
            </IconButton>
          </Drawer.Trigger>
          <Drawer.Content hideHandle className={style.filterDrawer}>
            <div className={style.filterDrawerContent}>
              <Drawer.Header className={style.filterDrawerHeader}>
                <Drawer.Title>Filters</Drawer.Title>
                <Drawer.Description>
                  {filters.length > 0
                    ? `${filters.length} filter${filters.length > 1 ? 's' : ''} applied`
                    : 'No filters applied'}
                </Drawer.Description>
              </Drawer.Header>
              <div className={style.filterDrawerBody}>
                <div className={style.form}>
                  <div className={style.formSection}>
                    <Label>Column</Label>
                    <Select.Root
                      value={selectedColumn}
                      onValueChange={setSelectedColumn}
                    >
                      <Select.Trigger aria-label="Select Column">
                        <Select.Value placeholder="Select column..." />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Group>
                          {shape?.propertyShapes
                            ?.filter((p) => p.label !== 'id')
                            .map((prop) => (
                              <Select.Item key={prop.label} value={prop.label}>
                                {prop.label
                                  .replace(/([A-Z])/g, ' $1')
                                  .replace(/_/g, ' ')
                                  .replace(/^./, (c) => c.toUpperCase())}
                              </Select.Item>
                            ))}
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </div>

                  {selectedColumn && availableOperators.length > 0 && (
                    <div className={style.formSection}>
                      <Label>Operator</Label>
                      <Select.Root
                        value={selectedOperator as string}
                        onValueChange={(val) => setSelectedOperator(val as FilterOperator)}
                      >
                        <Select.Trigger aria-label="Select Operator">
                          <Select.Value placeholder="Select operator..." />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Group>
                            {availableOperators.map((op) => (
                              <Select.Item key={op.value} value={op.value}>
                                {op.label}
                              </Select.Item>
                            ))}
                          </Select.Group>
                        </Select.Content>
                      </Select.Root>
                    </div>
                  )}

                  {selectedColumn && selectedOperator && (
                    <div className={style.formSection}>
                      <Label>Value</Label>
                      {isEnumColumn &&
                      selectedOperator === 'in' &&
                      selectedProperty &&
                      enumOptions(selectedProperty).length > 0 ? (
                        <div className={style.enumCheckboxes}>
                          {enumOptions(selectedProperty).map((item) => {
                            const val = item.id;
                            const checked = enumSelections.includes(val);
                            return (
                              <label key={val} className={style.enumCheckboxLabel}>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => {
                                    setEnumSelections((prev) =>
                                      checked
                                        ? prev.filter((v) => v !== val)
                                        : [...prev, val]
                                    );
                                  }}
                                />
                                <span>{humanizeEnumLabel(val)}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : selectedUiType === 'boolean' ? (
                        <Select.Root
                          value={filterValue}
                          onValueChange={setFilterValue}
                        >
                          <Select.Trigger aria-label="Select Value">
                            <Select.Value placeholder="Select..." />
                          </Select.Trigger>
                          <Select.Content>
                            <Select.Group>
                              <Select.Item value="true">Yes</Select.Item>
                              <Select.Item value="false">No</Select.Item>
                            </Select.Group>
                          </Select.Content>
                        </Select.Root>
                      ) : (
                        <Input
                          name="filterValue"
                          type={selectedUiType === 'number' ? 'number' : selectedUiType === 'date' || selectedUiType === 'datetime' ? 'date' : 'text'}
                          placeholder="Enter value..."
                          value={filterValue}
                          onChange={(e) => setFilterValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleFilterSubmit();
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <Typography className={style.filterNotice}>
                  Filters apply to loaded rows only
                </Typography>
              </div>
              <Drawer.Footer className={style.filterDrawerFooter}>
                <Drawer.Close asChild>
                  <Button variant="outline">Cancel</Button>
                </Drawer.Close>
                <Drawer.Close asChild>
                  <Button onClick={handleFilterSubmit}>Apply Filter</Button>
                </Drawer.Close>
              </Drawer.Footer>
            </div>
          </Drawer.Content>
        </Drawer.Root>
        {tableMode && onTableModeChange && (
          <div className={style.tableModeToggle}>
            <Button
              size="small"
              variant={tableMode === 'auto' ? 'solid' : 'outline'}
              onClick={() => onTableModeChange('auto')}
            >
              Smart
            </Button>
            <Button
              size="small"
              variant={tableMode === 'full' ? 'solid' : 'outline'}
              onClick={() => onTableModeChange('full')}
            >
              All
            </Button>
          </div>
        )}
        {isPickMode && selectionCount > 0 && (
          <Button
            size="small"
            onClick={handlePickSelected}
            style={{ marginLeft: 'auto' }}
          >
            <Icons.Check width="16" height="16" />
            Use Selected ({selectionCount}{pickMaxCount != null ? ` / ${pickMaxCount}` : ''})
          </Button>
        )}
      </div>

      {/* Selection bar — shown when items are selected (non-pick mode) */}
      <AnimatePresence>
        {hasSelection && !isPickMode && (
          <motion.div
            className={style.selectionBar}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <span className={style.selectionCount}>
              {selectionCount} selected
            </span>
            <div className={style.selectionActions}>
              <Button size="small" variant="ghost" onClick={clearSelection} disabled={batchOperationPending}>
                Clear
              </Button>
              {onBatchUpdate && (
                <Button
                  size="small"
                  onClick={() => setBatchEditOpen(true)}
                  disabled={batchOperationPending}
                >
                  <Icons.Pencil width={16} height={16} />
                  Edit Selected ({selectionCount})
                </Button>
              )}
              {canDelete && (
                <Button
                  size="small"
                  variant="outline"
                  className={style.deleteDataButton}
                  onClick={handleDeleteCollectively}
                  disabled={batchOperationPending}
                >
                  {batchOperationPending ? <Spinner size="small" /> : <Icons.Trash2 width={16} height={16} />}
                  Delete ({selectionCount})
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch result message */}
      <AnimatePresence>
        {batchResult && (
          <motion.div
            className={cl(style.batchResultBar, batchResult.isError && style.batchResultError)}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
          >
            {batchResult.message}
            <button className={style.batchResultDismiss} onClick={() => setBatchResult(null)}>
              <Icons.X width={14} height={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter badges bar */}
      <AnimatePresence>
        {filters.length > 0 && (
          <motion.div
            className={style.tableBar}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{
              duration: reducedMotion ? 0 : 0.25,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <div className={style.filterBar}>
              <>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.2,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                >
                  <Typography className={style.filterLabel}>
                    Filters ({filteredData.length} of {(data as any[]).length}):
                  </Typography>
                </motion.div>
                {filters.map((filter, index) => (
                  <motion.div
                    key={filter.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10, scale: 0.9 }}
                    transition={{
                      duration: reducedMotion ? 0 : 0.2,
                      delay: reducedMotion ? 0 : 0.1 + index * 0.05,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                  >
                    <FilterBadge
                      label={formatFilterLabel(filter)}
                      isActive={filter.isActive}
                      onToggle={() => handleFilterToggle(index)}
                      onRemove={() => handleFilterRemove(index)}
                    />
                  </motion.div>
                ))}
                {filters.length > 1 && (
                  <Button
                    size="small"
                    variant="ghost"
                    onClick={() => setFilters([])}
                  >
                    Clear all
                  </Button>
                )}
              </>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={style.tableContainer}>
        <table className={style.table}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className={style.tr}>
                <th className={cl(style.th, style.sticky, style.stickyLeft)}>
                  <Checkbox onCheckedChange={toggleSelectAll} />
                </th>
                {headerGroup.headers.map((header, index) => {
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={style.th}
                    >
                      {index === 0 ? (
                        <div>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </div>
                      ) : (
                        <div
                          {...{
                            className: header.column.getCanSort()
                              ? style.canSort
                              : '',
                            onClick: header.column.getToggleSortingHandler(),
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: <Icons.ChevronUp width={14} height={14} />,
                            desc: <Icons.ChevronDown width={14} height={14} />,
                          }[header.column.getIsSorted() as string] ?? (
                            <Icons.ChevronsLeftRight width={14} height={14} />
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className={cl(style.th, style.sticky, style.stickyRight)}>
                  Actions
                </th>
              </tr>
            ))}
          </thead>
          <motion.tbody
            variants={tableStaggerContainer}
            initial="initial"
            animate="animate"
          >
            {isLoading
              ? Array.from({ length: config.pageSize }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} columns={1} />
                ))
              : table.getRowModel().rows.map((row) => {
                  const rowUri = row.original?.id;
                  const rowSelected = rowUri ? isRowSelected(rowUri) : false;
                  return (
                    <motion.tr
                      key={row.id}
                      className={cl(
                        style.tr,
                        isPickMode && style.pickableRow,
                        isPickMode && pickLimitReached && !rowSelected && style.pickDisabledRow,
                      )}
                      variants={reducedMotion ? undefined : tableRowItem}
                      layout
                      onClick={isPickMode ? () => {
                        if (!rowUri) return;
                        if (pickLimitReached && !rowSelected) return;
                        toggleRowSelection(rowUri);
                      } : undefined}
                      style={isPickMode ? { cursor: pickLimitReached && !rowSelected ? 'not-allowed' : 'pointer' } : undefined}
                    >
                      <td
                        className={cl(style.td, style.sticky, style.stickyLeft)}
                        onClick={isPickMode ? (e) => e.stopPropagation() : undefined}
                      >
                        <Checkbox
                          onCheckedChange={() => {
                            if (!rowUri) return;
                            if (isPickMode && pickLimitReached && !rowSelected) return;
                            toggleRowSelection(rowUri);
                          }}
                          checked={rowSelected}
                          disabled={isPickMode && pickLimitReached && !rowSelected}
                        />
                      </td>
                      {row.getVisibleCells().map((cell) => {
                        return (
                          <td
                            key={cell.id}
                            className={cl(style.td, getCellStyle(cell))}
                          >
                            {renderCellContent(cell)}
                          </td>
                        );
                      })}
                      <td
                        className={cl(
                          style.td,
                          style.sticky,
                          style.stickyRight
                        )}
                      >
                        {isPickMode ? (
                          <Button
                            size="small"
                            onClick={() => handlePick(row)}
                            disabled={pickLimitReached && !rowSelected}
                          >
                            <Icons.Check width="16" height="16" />
                            Select
                          </Button>
                        ) : (
                          <div className={style.actionButtons}>
                            <IconButton
                              size="small"
                              variant="ghost"
                              aria-label="View"
                              className={cl(
                                style.actionTableButton,
                                style.viewAction
                              )}
                              onClick={() => handleView(row)}
                            >
                              <Icons.Eye width={16} height={16} />
                            </IconButton>
                            <IconButton
                              size="small"
                              variant="ghost"
                              aria-label="Edit"
                              className={cl(
                                style.actionTableButton,
                                style.editAction
                              )}
                              onClick={() => handleEdit(row)}
                            >
                              <Icons.Pencil width={16} height={16} />
                            </IconButton>
                            {/* The row's delete button was rendered unconditionally while
                                the dialog behind it was gated — so it was reachable without
                                the callbacks that make deletion work, and the dialog then
                                called an undefined previewDeletion. Same gate as the batch
                                action and the dialog. */}
                            {canDelete && (
                            <IconButton
                              size="small"
                              variant="ghost"
                              aria-label="Delete"
                              className={cl(
                                style.actionTableButton,
                                style.removeAction
                              )}
                              onClick={() => handleDelete(row)}
                            >
                              <Icons.Trash2 width={16} height={16} />
                            </IconButton>
                            )}
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
          </motion.tbody>
        </table>
      </div>
      <div className={style.pagination}>
        <Typography className={style.pageInfo}>
          Page{' '}
          <strong>
            {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount().toLocaleString()}
          </strong>
        </Typography>
        <div className={style.pageInput}>
          <Input
            size="small"
            type="number"
            className={style.goToPageForm}
            value={table.getState().pagination.pageIndex + 1}
            onChange={(e) => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0;
              table.setPageIndex(page);
            }}
          />
        </div>
        <div className={style.pageShowItem}>
          <Select.Root
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <Select.Trigger size="small">
              <Select.Value placeholder="Show Rows" />
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <Select.Item key={pageSize} value={pageSize.toString()}>
                    Show {pageSize}
                  </Select.Item>
                ))}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </div>
        <IconButton
          size="small"
          variant="outline"
          aria-label="First page"
          className={style.paginationButton}
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <Icons.ChevronsLeft width={18} height={18} />
        </IconButton>
        <IconButton
          size="small"
          variant="outline"
          aria-label="Previous page"
          className={style.paginationButton}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <Icons.ChevronLeft width={18} height={18} />
        </IconButton>
        <IconButton
          size="small"
          variant="outline"
          aria-label="Next page"
          className={style.paginationButton}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <Icons.ChevronRight width={18} height={18} />
        </IconButton>
        <IconButton
          size="small"
          variant="outline"
          aria-label="Last page"
          className={style.paginationButton}
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
        >
          <Icons.ChevronsRight width={18} height={18} />
        </IconButton>
      </div>

      {deletionTarget && canDelete && (
        <InstanceDeletionDialog
          isOpen
          projectId={deletionProjectId}
          targets={deletionTarget.targets}
          labels={deletionTarget.labels}
          onClose={() => setDeletionTarget(null)}
          onDeleted={handleDeletionCompleted}
          previewDeletion={previewDeletion!}
          executeDeletion={executeDeletion!}
        />
      )}

      {/* Batch edit drawer */}
      {onBatchUpdate && propertiesMap && (
        <BatchEditDrawer
          isOpen={batchEditOpen}
          onClose={() => setBatchEditOpen(false)}
          shape={shape}
          properties={propertiesMap}
          selectedCount={selectionCount}
          onApply={handleBatchApply}
          isLoading={batchOperationPending}
        />
      )}
    </div>
  );
}

export default ReactTable;
