import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface Column {
  id: string;
  name: string;
  type: "text" | "number";
  width?: number;
  fieldId?: string;
  hidden?: boolean;
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
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

export function TableView({
  columns,
  rows,
  onAddRow,
  onAddColumn,
  onUpdateCell,
  showAddRowButton = true,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
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

  // Keep track of the editing cell
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnIndex: number;
    value: string;
    originalValue: string | number | null;
  } | null>(null);

  // Parent container ref for virtualization
  const parentRef = useRef<HTMLDivElement>(null);

  // Set up virtualization with optimized settings for large datasets
  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? rows.length + 1 : rows.length, // Add 1 for loading row
    getScrollElement: () => parentRef.current,
    estimateSize: () => 41, // Height of each row
    overscan: 10, // Increased overscan for better infinite scroll performance
  });

  // Infinite scroll effect
  useEffect(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;

    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    if (
      lastItem.index >= rows.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    rows.length,
    isFetchingNextPage,
    rowVirtualizer.getVirtualItems(),
  ]);

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
    <div className="flex flex-col">
      <div
        ref={parentRef}
        className="relative h-full overflow-auto rounded-md border border-gray-200"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-50">
          <div className="flex border-b border-gray-200">
            {/* Row number header */}
            <div
              className="sticky left-0 z-20 flex h-[41px] items-center justify-center border-r bg-gray-50"
              style={{ width: rowNumberColumn.width }}
            ></div>

            {/* Column headers */}
            <div className="flex min-w-0">
              {columns.map((column) => (
                <div
                  key={column.id}
                  className="flex h-[41px] items-center border-r border-gray-200 bg-gray-50 px-4 text-left text-sm font-medium text-gray-600"
                  style={{ width: column.width ?? 200 }}
                >
                  {column.name}
                </div>
              ))}

              {/* Add column button */}
              <div className="flex h-[41px] w-10 items-center justify-center bg-gray-50">
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
            width: `${totalColumnsWidth}px`,
            position: "relative",
            contain: "strict", // Add contain property for better performance
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const isLoaderRow = virtualRow.index > rows.length - 1;
            const row = rows[virtualRow.index];

            if (isLoaderRow) {
              return (
                <div
                  key={virtualRow.index}
                  className="absolute top-0 left-0 flex w-full items-center justify-center border-b border-gray-200 bg-gray-50"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                    height: "41px",
                  }}
                >
                  {hasNextPage ? "Loading more..." : "Nothing more to load"}
                </div>
              );
            }

            if (!row) return null;

            return (
              <div
                key={virtualRow.index}
                data-index={virtualRow.index}
                className={cn(
                  "absolute top-0 left-0 flex w-full border-b border-gray-200",
                  virtualRow.index % 2 === 0 ? "bg-white" : "bg-gray-50",
                )}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  height: "41px", // Fixed height for better performance
                  willChange: "transform", // Optimize for animations
                  contain: "content", // Improve rendering performance
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
                  {columns.map((column, columnIndex) => {
                    const isEditing =
                      editingCell?.rowIndex === virtualRow.index &&
                      editingCell?.columnIndex === columnIndex;
                    const cellValue = row[column.id];

                    return (
                      <div
                        key={`${row.id}-${column.id}`}
                        className={cn(
                          "cursor-pointer border-r border-gray-200 px-4 py-2",
                          focusedCell?.rowIndex === virtualRow.index &&
                            focusedCell?.columnIndex === columnIndex &&
                            "bg-blue-50",
                          isEditing && "p-0", // Remove padding when editing
                        )}
                        style={{ width: column.width ?? 200 }}
                        onClick={() => {
                          if (
                            focusedCell?.rowIndex === virtualRow.index &&
                            focusedCell?.columnIndex === columnIndex
                          ) {
                            setEditingCell({
                              rowIndex: virtualRow.index,
                              columnIndex,
                              value: String(cellValue ?? ""),
                              originalValue: cellValue ?? null,
                            });
                          } else {
                            setFocusedCell({
                              rowIndex: virtualRow.index,
                              columnIndex,
                            });
                          }
                        }}
                        onDoubleClick={() => {
                          setEditingCell({
                            rowIndex: virtualRow.index,
                            columnIndex,
                            value: String(cellValue ?? ""),
                            originalValue: cellValue ?? null,
                          });
                        }}
                        onKeyDown={(e) => {
                          if (
                            focusedCell?.rowIndex === virtualRow.index &&
                            focusedCell?.columnIndex === columnIndex &&
                            (e.key === "Enter" || e.key === "F2")
                          ) {
                            setEditingCell({
                              rowIndex: virtualRow.index,
                              columnIndex,
                              value: String(cellValue ?? ""),
                              originalValue: cellValue ?? null,
                            });
                            e.preventDefault();
                          }
                        }}
                      >
                        {isEditing ? (
                          <CellInput
                            value={editingCell.value}
                            onChange={(e) =>
                              setEditingCell({
                                ...editingCell,
                                value: e.target.value,
                              })
                            }
                            onBlur={() => {
                              // Save the value when focus is lost
                              const newValue =
                                column.type === "number" &&
                                editingCell.value !== ""
                                  ? Number(editingCell.value)
                                  : editingCell.value || null;

                              // Only update if the value actually changed
                              const originalValue = editingCell.originalValue;
                              let hasChanged = false;

                              if (originalValue === null && newValue === null) {
                                hasChanged = false;
                              } else if (
                                originalValue === null ||
                                newValue === null
                              ) {
                                hasChanged = true;
                              } else if (column.type === "number") {
                                hasChanged =
                                  Number(originalValue) !== Number(newValue);
                              } else {
                                hasChanged =
                                  String(originalValue) !== String(newValue);
                              }

                              if (hasChanged) {
                                onUpdateCell(row.id, column.id, newValue);
                              }
                              setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur(); // Trigger onBlur
                              } else if (e.key === "Escape") {
                                setEditingCell(null); // Cancel editing
                              } else if (e.key === "Tab") {
                                e.preventDefault();
                                // 保存当前 cell
                                const newValue =
                                  column.type === "number" &&
                                  editingCell.value !== ""
                                    ? Number(editingCell.value)
                                    : editingCell.value || null;
                                const originalValue = editingCell.originalValue;
                                let hasChanged = false;
                                if (
                                  originalValue === null &&
                                  newValue === null
                                ) {
                                  hasChanged = false;
                                } else if (
                                  originalValue === null ||
                                  newValue === null
                                ) {
                                  hasChanged = true;
                                } else if (column.type === "number") {
                                  hasChanged =
                                    Number(originalValue) !== Number(newValue);
                                } else {
                                  hasChanged =
                                    String(originalValue) !== String(newValue);
                                }
                                if (hasChanged) {
                                  onUpdateCell(row.id, column.id, newValue);
                                }
                                // 计算下一个 cell
                                let nextRow = virtualRow.index;
                                let nextCol =
                                  columnIndex + (e.shiftKey ? -1 : 1);
                                if (nextCol < 0) {
                                  nextRow = virtualRow.index - 1;
                                  nextCol = columns.length - 1;
                                } else if (nextCol >= columns.length) {
                                  nextRow = virtualRow.index + 1;
                                  nextCol = 0;
                                }
                                setEditingCell(null);
                                // 跳转到下一个 cell 并进入编辑
                                setTimeout(() => {
                                  if (
                                    nextRow >= 0 &&
                                    nextRow < rows.length &&
                                    nextCol >= 0 &&
                                    nextCol < columns.length &&
                                    rows[nextRow] &&
                                    columns[nextCol]
                                  ) {
                                    setFocusedCell({
                                      rowIndex: nextRow,
                                      columnIndex: nextCol,
                                    });
                                    setEditingCell({
                                      rowIndex: nextRow,
                                      columnIndex: nextCol,
                                      value: String(
                                        rows[nextRow]?.[
                                          columns[nextCol]?.id ?? ""
                                        ] ?? "",
                                      ),
                                      originalValue:
                                        rows[nextRow]?.[
                                          columns[nextCol]?.id ?? ""
                                        ] ?? null,
                                    });
                                  }
                                }, 0);
                              }
                            }}
                            type={column.type === "number" ? "number" : "text"}
                          />
                        ) : (
                          <span className="block truncate">
                            {cellValue ?? ""}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add row button */}
        {showAddRowButton && (
          <div className="sticky bottom-0 left-0 z-10 flex border-t border-gray-200 bg-white">
            <div
              className="flex items-center justify-center"
              style={{ width: rowNumberColumn.width }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onAddRow}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap with React.memo to prevent unnecessary re-renders
const MemoizedTableView = React.memo(TableView);
export { MemoizedTableView };

// 在 TableView 组件外部定义 CellInput
function CellInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
  type,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  type: string;
}) {
  const localInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (localInputRef.current) {
      localInputRef.current.focus();
    }
  }, []);
  return (
    <input
      ref={localInputRef}
      type={type}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="h-full w-full border-0 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
    />
  );
}
