import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";

interface TableViewProps {
  columns: string[];
  rows: Record<string, string>[];
  onAddColumn?: () => void;
  onAddRow?: () => void;
  onCellEdit?: (rowIndex: number, columnName: string, value: string) => void;
}

export function TableView({
  columns,
  rows,
  onAddColumn,
  onAddRow,
  onCellEdit,
}: TableViewProps) {
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnName: string;
  } | null>(null);

  return (
    <div className="relative overflow-auto">
      <div className="flex">
        {/* Row numbers header */}
        <div className="sticky left-0 z-20 w-12 border-r border-b bg-gray-50">
          <div className="h-10" />
        </div>

        {/* Column headers */}
        <div className="flex">
          {columns.map((column) => (
            <div
              key={column}
              className="w-[200px] border-r border-b bg-gray-50 px-4 py-2"
            >
              {column}
            </div>
          ))}

          {/* Add column button */}
          <div className="flex w-10 items-center justify-center bg-gray-50">
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

      {/* Table body */}
      <div>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {/* Row number */}
            <div className="sticky left-0 z-10 flex w-12 items-center justify-center border-r bg-gray-50">
              {rowIndex + 1}
            </div>

            {/* Row cells */}
            {columns.map((column) => (
              <div
                key={column}
                className="w-[200px] border-r border-b px-4 py-2"
                onClick={() => setEditingCell({ rowIndex, columnName: column })}
              >
                {editingCell?.rowIndex === rowIndex &&
                editingCell?.columnName === column ? (
                  <input
                    type="text"
                    value={row[column] ?? ""}
                    className="w-full focus:outline-none"
                    onChange={(e) =>
                      onCellEdit?.(rowIndex, column, e.target.value)
                    }
                    onBlur={() => setEditingCell(null)}
                    autoFocus
                  />
                ) : (
                  (row[column] ?? "")
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Add row button */}
        <div className="flex">
          <div className="sticky left-0 z-10 flex w-12 items-center justify-center border-r bg-gray-50">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onAddRow}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
