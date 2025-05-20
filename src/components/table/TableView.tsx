import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface Column {
  id: string;
  name: string;
  type: "text" | "number";
  width?: number;
}

export interface TableRow {
  id: string;
  [key: string]: string | number | null;
}

export interface TableViewProps {
  columns: Column[];
  rows: TableRow[];
  onAddRow: () => void;
  onAddColumn: () => void;
  onUpdateCell: (
    rowId: string,
    columnId: string,
    value: string | number | null,
  ) => void;
  showAddRowButton?: boolean;
  onAdd100kRows?: () => void;
}

export function TableView({
  columns,
  rows,
  onAddRow,
  onAddColumn,
  onUpdateCell,
  showAddRowButton = true,
  onAdd100kRows,
}: TableViewProps) {
  // Row number column
  const rowNumberColumn = {
    id: "rowNumber",
    name: "",
    type: "number" as const,
    width: 40,
  };

  const allColumns = [rowNumberColumn, ...columns];

  // Calculate total width of all columns
  const totalColumnsWidth = allColumns.reduce(
    (total, col) => total + (col.width ?? 200),
    0,
  );

  // Keep track of the currently focused cell
  const [focusedCell, setFocusedCell] = useState<{
    rowIndex: number;
    columnIndex: number;
  } | null>(null);

  // Parent container ref for virtualization
  const parentRef = useRef<HTMLDivElement>(null);

  // Set up virtualization with optimized settings for large datasets
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 41, // Height of each row
    overscan: 10, // Increased overscan for smoother scrolling
    paddingStart: 0,
    paddingEnd: 0,
  });

  // Handle keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) => {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      const nextColumnIndex = e.shiftKey ? columnIndex - 1 : columnIndex + 1;
      const nextRowIndex =
        e.shiftKey && columnIndex === 0
          ? rowIndex - 1
          : !e.shiftKey && columnIndex === columns.length - 1
            ? rowIndex + 1
            : rowIndex;

      if (nextRowIndex >= 0 && nextRowIndex < rows.length) {
        if (nextColumnIndex >= 0 && nextColumnIndex < columns.length) {
          setFocusedCell({
            rowIndex: nextRowIndex,
            columnIndex: nextColumnIndex,
          });
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {onAdd100kRows && (
        <div className="flex justify-end">
          <Button onClick={onAdd100kRows} variant="outline" size="sm">
            Add 100k Rows
          </Button>
        </div>
      )}

      <div
        ref={parentRef}
        className="relative overflow-auto rounded-md border border-gray-200"
        style={{ height: "calc(100vh - 200px)" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-50">
          <div className="flex">
            {/* Row number header */}
            <div
              className="sticky left-0 z-20 border-r border-b border-gray-200 bg-gray-50"
              style={{ width: rowNumberColumn.width }}
            >
              <div className="h-10" />
            </div>

            {/* Column headers */}
            <div className="flex min-w-0">
              {columns.map((column) => (
                <div
                  key={column.id}
                  className="border-r border-b border-gray-200 bg-gray-50 px-4 py-2 text-left text-sm font-medium text-gray-600"
                  style={{ width: column.width ?? 200 }}
                >
                  {column.name}
                </div>
              ))}

              {/* Add column button */}
              <div className="flex w-10 items-center justify-center border-b border-gray-200 bg-gray-50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={onAddColumn}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Virtualized rows */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            return (
              <div
                key={virtualRow.index}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={cn(
                  "absolute top-0 left-0 flex w-full border-b border-gray-200",
                  virtualRow.index % 2 === 0 ? "bg-white" : "bg-gray-50",
                )}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                {/* Row number */}
                <div
                  className="sticky left-0 z-10 flex items-center justify-center border-r border-gray-200 bg-inherit"
                  style={{ width: rowNumberColumn.width }}
                >
                  {virtualRow.index + 1}
                </div>

                {/* Row cells */}
                <div className="flex min-w-0">
                  {columns.map((column, columnIndex) => (
                    <div
                      key={`${row.id}-${column.id}`}
                      className={cn(
                        "border-r border-gray-200 px-4 py-2",
                        focusedCell?.rowIndex === virtualRow.index &&
                          focusedCell?.columnIndex === columnIndex &&
                          "bg-blue-50",
                      )}
                      style={{ width: column.width ?? 200 }}
                      onClick={() =>
                        setFocusedCell({
                          rowIndex: virtualRow.index,
                          columnIndex,
                        })
                      }
                    >
                      {row[column.id]}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add row button */}
        {showAddRowButton && (
          <div className="sticky bottom-0 flex w-full items-center justify-center border-t border-gray-200 bg-white py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onAddRow}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
