import React from "react";
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
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className="border-r border-b border-gray-200 p-2 last:border-r-0"
                    style={{
                      width: column.width ? `${column.width}px` : "200px",
                    }}
                  >
                    <input
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
