import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

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
}

export function TableView({
  columns,
  rows,
  onAddRow,
  onAddColumn,
  onUpdateCell,
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

  // Refs for inputs to programmatically focus them
  const inputRefs = useRef<Record<string, Record<string, HTMLInputElement>>>(
    {},
  );

  // Handle keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) => {
    const isLastColumn = columnIndex === columns.length - 1;
    const isFirstColumn = columnIndex === 0;
    const isLastRow = rowIndex === rows.length - 1;
    const isFirstRow = rowIndex === 0;

    // Tab navigation: Move right or to the next row
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      if (isLastColumn) {
        if (!isLastRow) {
          // Move to first column of next row
          focusCell(rowIndex + 1, 0);
        } else {
          // If it's the last cell, add a new row and focus its first cell
          onAddRow();
          // Wait for the new row to be added to the state
          setTimeout(() => {
            if (rows.length > rowIndex) {
              focusCell(rows.length, 0);
            }
          }, 100);
        }
      } else {
        // Move to next column in same row
        focusCell(rowIndex, columnIndex + 1);
      }
    }
    // Shift+Tab navigation: Move left or to the previous row
    else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (isFirstColumn) {
        if (!isFirstRow) {
          // Move to last column of previous row
          focusCell(rowIndex - 1, columns.length - 1);
        }
      } else {
        // Move to previous column in same row
        focusCell(rowIndex, columnIndex - 1);
      }
    }
    // Enter key: Move down or to the first cell of next row
    else if (e.key === "Enter") {
      e.preventDefault();
      if (!isLastRow) {
        focusCell(rowIndex + 1, columnIndex);
      } else {
        // If it's the last row, add a new row and focus the cell in the same column
        onAddRow();
        setTimeout(() => {
          if (rows.length > rowIndex) {
            focusCell(rows.length, columnIndex);
          }
        }, 100);
      }
    }
    // Arrow keys for navigation (optional)
    else if (e.key === "ArrowDown" && !isLastRow) {
      e.preventDefault();
      focusCell(rowIndex + 1, columnIndex);
    } else if (e.key === "ArrowUp" && !isFirstRow) {
      e.preventDefault();
      focusCell(rowIndex - 1, columnIndex);
    } else if (
      e.key === "ArrowRight" &&
      !isLastColumn &&
      e.currentTarget.selectionStart === e.currentTarget.value.length
    ) {
      e.preventDefault();
      focusCell(rowIndex, columnIndex + 1);
    } else if (
      e.key === "ArrowLeft" &&
      !isFirstColumn &&
      e.currentTarget.selectionStart === 0
    ) {
      e.preventDefault();
      focusCell(rowIndex, columnIndex - 1);
    }
  };

  // Focus a specific cell
  const focusCell = (rowIndex: number, columnIndex: number) => {
    if (
      rowIndex >= 0 &&
      rowIndex < rows.length &&
      columnIndex >= 0 &&
      columnIndex < columns.length
    ) {
      const rowId = rows[rowIndex]?.id;
      const columnId = columns[columnIndex]?.id;

      if (!rowId || !columnId) return;

      setFocusedCell({ rowIndex, columnIndex });

      // Use setTimeout to ensure the focus happens after the state update
      setTimeout(() => {
        const input = inputRefs.current[rowId]?.[columnId];
        if (input) {
          input.focus();
          input.select();
        }
      }, 0);
    }
  };

  return (
    <div className="overflow-auto">
      <div className="min-w-max">
        <table
          className="border-collapse"
          style={{ width: `${totalColumnsWidth + 40}px` }}
        >
          <thead>
            <tr className="border-b border-gray-200">
              {/* Row number header */}
              <th
                className="w-10 border-r border-gray-200 bg-gray-50 p-2 text-center"
                style={{ width: rowNumberColumn.width }}
              >
                {/* Empty header for row numbers */}
              </th>
              {/* Data columns headers */}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="border-r border-gray-200 bg-gray-50 p-2 text-left text-sm font-medium text-gray-600 last:border-r-0"
                  style={{
                    width: column.width ? `${column.width}px` : "200px",
                  }}
                >
                  {column.name}
                </th>
              ))}
              <th className="w-10 border-b border-gray-200 bg-gray-50 p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={onAddColumn}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id} className="hover:bg-gray-50/50">
                {/* Row number cell */}
                <td
                  className="border-r border-b border-gray-200 p-2 text-center text-sm text-gray-500"
                  style={{ width: rowNumberColumn.width }}
                >
                  {rowIndex + 1}
                </td>
                {/* Data cells */}
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.id}
                    className={cn(
                      "border-r border-b border-gray-200 p-2 last:border-r-0",
                      focusedCell?.rowIndex === rowIndex &&
                        focusedCell?.columnIndex === columnIndex &&
                        "bg-blue-50",
                    )}
                    style={{
                      width: column.width ? `${column.width}px` : "200px",
                    }}
                    onClick={() => focusCell(rowIndex, columnIndex)}
                  >
                    <input
                      ref={(el) => {
                        if (el) {
                          // Ensure the row object exists for this ref
                          inputRefs.current[row.id] ??= {};
                          // Now we can safely assign the element
                          inputRefs.current[row.id]![column.id] = el;
                        }
                      }}
                      type={column.type === "number" ? "number" : "text"}
                      value={row[column.id] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        onUpdateCell(
                          row.id,
                          column.id,
                          value === ""
                            ? null
                            : column.type === "number"
                              ? Number(value)
                              : value,
                        );
                      }}
                      onFocus={() => setFocusedCell({ rowIndex, columnIndex })}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, columnIndex)}
                      className="w-full border-none bg-transparent p-0 focus:ring-0 focus:outline-none"
                    />
                  </td>
                ))}
                <td className="w-10 border-b border-gray-200 p-2" />
              </tr>
            ))}
            {/* Add row button as a row */}
            <tr>
              <td
                className="border-r border-b border-gray-200 p-2 text-center"
                style={{ width: rowNumberColumn.width }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="mx-auto h-6 w-6 p-0"
                  onClick={onAddRow}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </td>
              {columns.map((column) => (
                <td
                  key={column.id}
                  className="border-r border-b border-gray-200 p-2 last:border-r-0"
                  style={{
                    width: column.width ? `${column.width}px` : "200px",
                  }}
                />
              ))}
              <td className="w-10 border-b border-gray-200 p-2" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
