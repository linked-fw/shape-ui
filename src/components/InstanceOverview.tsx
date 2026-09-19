import { ColumnDef } from '@tanstack/react-table';
import type { ShapeInstancesQueryConfig } from '../shape/contracts.js';
import type { PropertyShapeWire, NodeShapeWire } from '@_linked/core/shapes/nodeShapeWire';
import { useDataManagerHost } from '../hostContext.js';
import type { TableMode } from '../columns.js';
import { getNodeDisplay } from '../shape/nodeDisplay.js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ImageThumb from '@_linked/primitives/components/ImageThumb';
import {NodeBadge} from './NodeBadge.js';
import style from './InstanceOverview.module.css';
import ReactTable, { type ReactTableProps } from './ReactTable.js';

type PropertiesMap = Record<string, PropertyShapeWire>;
type InstanceRecord<P extends PropertiesMap> = Partial<
  Record<keyof P, unknown>
>;

export interface BatchResult {
  succeeded: string[];
  failed: string[];
}

interface InstanceOverviewProps<
  P extends PropertiesMap = PropertiesMap,
  I extends InstanceRecord<P> = InstanceRecord<P>,
> {
  customColumns?: any;
  instances: I[];
  /**
   * Total row count of the whole dataset when `instances` is one server-fetched page.
   * Omit it for client-side pagination over the full `instances` array. Forwarded to
   * `ReactTable`, which switches to manual pagination when it is set.
   */
  totalCount?: number;
  properties: P;
  shape?: NodeShapeWire;
  isLoading?: boolean;
  config?: ShapeInstancesQueryConfig;
  setConfig?: (updated: ShapeInstancesQueryConfig) => void;
  onSelectionChange?: (selectedRows: number[], selectedInstances: I[]) => void;
  isPickMode?: boolean;
  pickMaxCount?: number;
  pickAlreadySelected?: { id: string; label: string; image?: string }[];
  deletionProjectId?: string;
  previewDeletion?: ReactTableProps['previewDeletion'];
  executeDeletion?: ReactTableProps['executeDeletion'];
  onInstancesDeleted?: ReactTableProps['onInstancesDeleted'];
  onBatchUpdate?: (changes: Record<string, any>, uris: string[]) => Promise<BatchResult>;
  tableMode?: TableMode;
  onTableModeChange?: (mode: TableMode) => void;
}

function InstanceOverview<
  P extends PropertiesMap,
  I extends InstanceRecord<P>,
>({
  customColumns,
  instances,
  totalCount,
  properties,
  shape,
  isLoading = false,
  config,
  setConfig,
  onSelectionChange,
  isPickMode = false,
  pickMaxCount,
  pickAlreadySelected,
  deletionProjectId,
  previewDeletion,
  executeDeletion,
  onInstancesDeleted,
  onBatchUpdate,
  tableMode,
  onTableModeChange,
}: InstanceOverviewProps<P, I>) {
  // Pick mode is a host flow: the host knows where the picker was opened from and what to
  // do with the choice. This component only knows that a choice was made.
  //
  // There is no fallback. The fallback was CN's sessionStorage-plus-router round trip,
  // which is exactly the app-specific knowledge that has no business in a component meant
  // to run inside someone else's app — and holding on to it kept `routes.tsx` in the
  // import graph, which drags in the whole application.
  const host = useDataManagerHost();

  const handlePickInstance = (instance: { id: string; label: string; image?: string }) =>
    host.picking?.select([instance]);

  const handlePickInstances = (
    instances: { id: string; label: string; image?: string }[],
  ) => host.picking?.select(instances);

  // URI-based selection — stable across sort/filter/pagination
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());

  const toggleSelectAll = useCallback(() => {
    setSelectedUris((prev) => {
      if (prev.size > 0) {
        // Deselect all
        return new Set();
      }
      // Select all visible instances
      const allUris = new Set<string>();
      (instances as any[]).forEach((inst) => {
        if (inst?.id) allUris.add(inst.id);
      });
      return allUris;
    });
  }, [instances]);

  const toggleRowSelection = useCallback((uri: string) => {
    setSelectedUris((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  }, []);

  const isRowSelected = useCallback(
    (uri: string) => selectedUris.has(uri),
    [selectedUris]
  );

  const clearSelection = useCallback(() => {
    setSelectedUris(new Set());
  }, []);

  // Remove succeeded URIs from selection after batch ops
  const removeFromSelection = useCallback((uris: string[]) => {
    setSelectedUris((prev) => {
      const next = new Set(prev);
      for (const uri of uris) next.delete(uri);
      return next;
    });
  }, []);

  const hasSelection = selectedUris.size > 0;

  // Pre-select rows matching pickAlreadySelected when data loads
  const preSelectDone = useRef(false);
  useEffect(() => {
    if (preSelectDone.current || !isPickMode || !pickAlreadySelected?.length || !instances?.length) return;
    preSelectDone.current = true;
    const alreadyIds = new Set(pickAlreadySelected.map((a) => a.id));
    const matching = new Set<string>();
    (instances as any[]).forEach((inst) => {
      if (inst?.id && alreadyIds.has(inst.id)) matching.add(inst.id);
    });
    if (matching.size > 0) {
      setSelectedUris(matching);
    }
  }, [instances, isPickMode, pickAlreadySelected]);

  const [_config, _setConfig] = useState(
    config || {
      pageIndex: 0,
      pageSize: 10,
      filters: [],
    }
  );
  // Config state can be handled by the parent or here. When the parent owns it, `config` is
  // the live value and `_config` is only the initial snapshot — so the table must read
  // `config` when present, or a parent-driven page change (server-side pagination) would
  // never reach it.
  const __setConfig = setConfig || _setConfig;

  const handleNodeClick = (nodeValue: any, propertyName: string) => {
    // Get the property details to access valueShape
    const property = properties[propertyName];
    if (property && property.valueShape && nodeValue.id) {
      // Navigate to the view page for this node
      host.navigate?.toInstance(property.valueShape.id, nodeValue.id);
    }
  };

  // Notify parent when selection changes (chatbot integration)
  useEffect(() => {
    if (onSelectionChange) {
      const selectedInstances = (instances as any[]).filter((inst) => inst?.id && selectedUris.has(inst.id));
      onSelectionChange(
        Array.from(selectedUris).map((uri) => (instances as any[]).findIndex((inst) => inst?.id === uri)).filter((i) => i >= 0),
        selectedInstances
      );
    }
  }, [selectedUris]);


  let initialColumns: ColumnDef<I>[] = [
    {
      id: 'selection',
      cell: ({ row }) => (
        <input
          type="hidden"
          onChange={() => toggleRowSelection((row.original as any)?.id)}
          checked={isRowSelected((row.original as any)?.id)}
        />
      ),
    },
  ];

  let columnConfig;

  const cell = (info) => {
    console.log('info cell', info);
    return info.getValue();
  };

  if (customColumns) {
    columnConfig = customColumns.map((config) => {
      return {
        id: config.label || config.property.label,
        accessorKey: config.label || config.property.label,
        cell: cell,
        accessorFn: config.renderCell,
      };
    });
    initialColumns.push(...columnConfig);
  } else {
    //dynamically define the columns based on the properties of the shape
    Object.entries(properties || {}).forEach(([propLabel, propShape]) => {
      //skip rdf:type
      if (propShape.id === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        return;
      }
      columnConfig = {
        id: propShape.id,
        // accessorFn, NOT accessorKey: TanStack reads a key as a deep PATH, so a property
        // labelled "Avg. basket" was looked up as row["Avg"][" basket"] and rendered blank
        // while every other column on the same row was fine. Labels are written by people and
        // routinely contain a dot; reading the row directly removes the trap.
        accessorFn: (row: any) => row?.[propLabel],
        cell: (info) => {
          let value = info.getValue();

          const parseLiteral = (value: any) => {
            let literalText;
            if (value instanceof Date) {
              literalText = value.toLocaleString();
            } else if (typeof value === 'boolean') {
              literalText = value ? 'Yes' : 'No';
            } else if (typeof value === 'number') {
              literalText = value.toString();
            } else if (typeof value === 'string') {
              literalText = value;
            } else {
              literalText = value;
            }
            return <span className={style.literal}>{literalText}</span>;
          };

          const isNode = (value: any) => {
            return value && typeof value === 'object' && value.id;
          };

          const parseValue = (value: any, forceLiteral: boolean = false) => {
            // Handle ImageObject (has contentUrl)
            if (value && typeof value === 'object' && value.contentUrl) {
              return <ImageThumb src={value.contentUrl} size={32} alt={value.label || propLabel} clickToEnlarge={true} />;
            }

            if (isNode(value)) {
              const images = value.image;
              const firstImage = Array.isArray(images) ? images[0] : images;

              if (firstImage) {
                const imgSrc = typeof firstImage === 'object' && firstImage.contentUrl
                  ? String(firstImage.contentUrl)
                  : String(firstImage);
                return <ImageThumb src={imgSrc} size={32} alt={value.label || propLabel} clickToEnlarge={true} />;
              }

              let identifier;
              const otherProperties = Object.keys(value).filter(key => key !== 'id');
              if (otherProperties.length > 0) {
                for (const property of otherProperties) {
                  if (value[property]) {
                    identifier = value[property];
                    break;
                  }
                }
              }
              if(!identifier) {
                identifier = getNodeDisplay(value);
              }
              return forceLiteral ? (
                identifier
              ) : (
                <NodeBadge
                  text={identifier}
                  onClick={() => handleNodeClick(value, propLabel)}
                  clickable={true}
                />
              );
            }
            return parseLiteral(value);
          };

          if (Array.isArray(value)) {
            const maxValues = 3;
            const valuesToShow = value.slice(0, maxValues);
            const leftOver = value.length - maxValues;
            if (leftOver > 0) {
              const title = `${leftOver} more values: ${value
                .slice(maxValues)
                .map((val) => parseValue(val, true))
                .join(', ')}`;
              valuesToShow.push(
                <NodeBadge
                  text={`(${leftOver}...)`}
                  title={title}
                  clickable={false}
                />
              );
            }
            return valuesToShow.map((val, index) => {
              const parsed = parseValue(val);
              const isCurrentLiteral =
                !isNode(val) && !React.isValidElement(val);
              const nextVal = valuesToShow[index + 1];
              const isNextLiteral =
                nextVal && !isNode(nextVal) && !React.isValidElement(nextVal);
              const needsComma = isCurrentLiteral && isNextLiteral;

              return (
                <React.Fragment key={index}>
                  {parsed}
                  {needsComma ? ', ' : ' '}
                </React.Fragment>
              );
            });
          } else {
            return parseValue(value);
          }
        },
        header: propLabel
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .replace(/^./, (char) => char.toUpperCase()),
        footer: (props) => props.column.id,
      };

      initialColumns.push(columnConfig);
    });
  }

  const columns = React.useMemo<ColumnDef<I>[]>(() => initialColumns, [properties]);

  return (
    <ReactTable
      data={instances}
      columns={columns}
      toggleSelectAll={toggleSelectAll}
      isRowSelected={isRowSelected}
      selectedUris={selectedUris}
      toggleRowSelection={toggleRowSelection}
      clearSelection={clearSelection}
      removeFromSelection={removeFromSelection}
      hasSelection={hasSelection}
      config={config || _config}
      setConfig={__setConfig}
      totalCount={totalCount}
      shape={shape}
      properties={properties}
      isLoading={isLoading}
      isPickMode={isPickMode}
      onPickInstance={handlePickInstance}
      onPickInstances={handlePickInstances}
      pickMaxCount={pickMaxCount}
      pickAlreadySelected={pickAlreadySelected}
      deletionProjectId={deletionProjectId}
      previewDeletion={previewDeletion}
      executeDeletion={executeDeletion}
      onInstancesDeleted={onInstancesDeleted}
      onBatchUpdate={onBatchUpdate}
      tableMode={tableMode}
      onTableModeChange={onTableModeChange}
    />
  );
}

export default InstanceOverview;
