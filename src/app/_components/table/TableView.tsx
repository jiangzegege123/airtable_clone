import { Plus } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "~/components/ui/button";
import { useVirtualizer } from "@tanstack/react-virtual";

interface TableViewProps {
  columns: string[];
  rows: Record<string, string>[];
  onAddColumn?: () => void;
  onAddRow?: () => void;
  onCellEdit?: (rowIndex: number, columnName: string, value: string) => void;
  onAdd100kRows?: () => void;
}

export function TableView({
  columns,
  rows,
  onAddColumn,
  onAddRow,
  onCellEdit,
  onAdd100kRows,
}: TableViewProps) {
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnName: string;
  } | null>(null);

  // Parent container ref for virtualization
  const parentRef = useRef<HTMLDivElement>(null);

  // Set up virtualization
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 41, // Approximate height of each row
    overscan: 5,
  });

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
        className="relative overflow-auto"
        ref={parentRef}
        style={{ height: "calc(100vh - 200px)" }}
      >
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
                className="absolute flex w-full"
                style={{
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                {/* Row number */}
                <div className="sticky left-0 z-10 flex w-12 items-center justify-center border-r bg-gray-50">
                  {virtualRow.index + 1}
                </div>

                {/* Row cells */}
                {columns.map((column) => (
                  <div
                    key={column}
                    className="w-[200px] border-r border-b px-4 py-2"
                    onClick={() =>
                      setEditingCell({
                        rowIndex: virtualRow.index,
                        columnName: column,
                      })
                    }
                  >
                    {editingCell?.rowIndex === virtualRow.index &&
                    editingCell?.columnName === column ? (
                      <input
                        type="text"
                        value={row[column] ?? ""}
                        className="w-full focus:outline-none"
                        onChange={(e) =>
                          onCellEdit?.(virtualRow.index, column, e.target.value)
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
            );
          })}
        </div>

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
