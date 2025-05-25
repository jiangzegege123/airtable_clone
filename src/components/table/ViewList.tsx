import { Plus, Grid } from "lucide-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { useState, useEffect } from "react";
import type { TRPCClientError } from "@trpc/client";
import type { AppRouter } from "~/server/api/root";

interface ViewListProps {
  tableId: string;
  onViewSelect: (viewId: string) => void;
  activeViewId?: string;
}

interface View {
  id: string;
  name: string;
  tableId: string;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
  hiddenFields: string[];
  filters: {
    id: string;
    viewId: string;
    fieldId: string;
    operator: string;
    value: string | null;
  }[];
  sorts: {
    id: string;
    viewId: string;
    fieldId: string;
    direction: string;
    order: number;
  }[];
}

export function ViewList({
  tableId,
  onViewSelect,
  activeViewId,
}: ViewListProps) {
  const [showNewViewInput, setShowNewViewInput] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const utils = api.useUtils();

  const { data: views = [] } = api.view.list.useQuery<View[]>(
    { tableId },
    {
      enabled: !!tableId,
    },
  );

  // Use useEffect to handle default view selection
  useEffect(() => {
    // Remove automatic view selection logic as it's now handled in the parent component
    // This prevents conflicts and redundant view selections
  }, [activeViewId, views, onViewSelect]);

  const createView = api.view.create.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
      setNewViewName("");
      setShowNewViewInput(false);
    },
  });

  const deleteView = api.view.delete.useMutation({
    onSuccess: () => {
      void utils.view.list.invalidate({ tableId });
    },
  });

  const handleCreateView = () => {
    if (!newViewName.trim()) return;
    createView.mutate({
      name: newViewName,
      tableId,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Views List */}
      <div className="space-y-1">
        {views.map((view) => {
          const isActive = activeViewId === view.id;
          return (
            <div
              key={view.id}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 transition-colors ${
                isActive ? "bg-gray-200 shadow-sm" : "hover:bg-gray-100"
              }`}
            >
              <button
                className={`flex items-center gap-2 text-left text-sm ${
                  isActive ? "font-medium" : ""
                }`}
                onClick={() => onViewSelect(view.id)}
              >
                <Grid
                  className={`h-4 w-4 ${
                    isActive ? "text-blue-600" : "text-gray-500"
                  }`}
                />
                {view.name}
              </button>
              {!view.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600 ${
                    isActive
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={() => deleteView.mutate({ id: view.id })}
                >
                  ×
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Create New View Section */}
      {showNewViewInput ? (
        <div className="px-2">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="Enter view name..."
              className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateView();
                } else if (e.key === "Escape") {
                  setShowNewViewInput(false);
                  setNewViewName("");
                }
              }}
            />
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setShowNewViewInput(false);
                  setNewViewName("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleCreateView}
                disabled={!newViewName.trim()}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="flex w-full items-center justify-start gap-2 px-2 text-sm text-gray-600 hover:bg-gray-100"
          onClick={() => setShowNewViewInput(true)}
        >
          <Plus className="h-4 w-4" />
          Create view
        </Button>
      )}
    </div>
  );
}
