import { Trash2, Table } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface SidebarTableTabProps {
  table: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    baseId: string;
  };
  isSelected: boolean;
  isCollapsed: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function SidebarTableTab({
  table,
  isSelected,
  isCollapsed,
  onSelect,
  onDelete,
}: SidebarTableTabProps) {
  if (isCollapsed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-10 w-10 justify-center p-0",
          isSelected ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100",
        )}
        onClick={onSelect}
        title={table.name}
      >
        <Table className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center justify-between rounded-md px-2 py-2 transition-colors",
        isSelected
          ? "border border-blue-200 bg-blue-100 text-blue-600"
          : "hover:bg-gray-100",
      )}
      onClick={onSelect}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Table
          className={cn(
            "h-4 w-4 flex-shrink-0",
            isSelected ? "text-blue-600" : "text-gray-500",
          )}
        />
        <span className="truncate text-sm font-medium">{table.name}</span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
