import { Plus, X, ArrowUpDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { RouterOutputs } from "~/trpc/shared";

interface SortPanelProps {
  tableId: string;
  viewId: string;
  onClose: (event?: React.MouseEvent) => void;
}

type Direction = "asc" | "desc";
type BaseSort = RouterOutputs["view"]["getSorts"][number];

interface Sort extends Omit<BaseSort, "direction"> {
  direction: Direction;
}

type UpdateSortAction =
  | { type: "direction"; sortId: string; value: Direction }
  | { type: "fieldId"; sortId: string; value: string };

type SortMutationInput = {
  id: string;
  fieldId: string;
  direction: Direction;
  order: number;
};

export function SortPanel({ tableId, viewId, onClose }: SortPanelProps) {
  const [sorts, setSorts] = useState<Sort[]>([]);
  const utils = api.useUtils();

  // Fetch fields for the current table
  const { data: fields = [] } = api.field.list.useQuery(
    { tableId },
    {
      enabled: !!tableId,
    },
  );

  // Fetch existing sorts for the view
  const { data: existingSorts } = api.view.getSorts.useQuery(
    { viewId },
    {
      enabled: !!viewId,
    },
  );

  // Update sorts when existingSorts changes
  useEffect(() => {
    if (existingSorts) {
      const typedSorts = existingSorts.map((sort) => ({
        ...sort,
        direction: sort.direction as Direction,
      }));
      setSorts(typedSorts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }
  }, [existingSorts]);

  const addSort = api.view.addSort.useMutation({
    onMutate: async (newSort) => {
      try {
        // Only cancel sort-related queries
        await utils.view.getSorts.cancel({ viewId });

        // Save previous state for error recovery
        const previousSorts = [...sorts];

        // Don't do optimistic update here - it's already done in handleUpdateSort
        return { previousSorts };
      } catch (error) {
        return undefined;
      }
    },
    onError: (error, variables, context) => {
      if (context?.previousSorts) {
        setSorts(context.previousSorts);
      }
      console.error("Error adding sort:", error);
    },
    onSettled: async () => {
      // Refresh sorts data to get the real sort ID from server
      await utils.view.getSorts.invalidate({ viewId });
      // Also invalidate table data to trigger re-fetch with new sorting
      await utils.table.getById.invalidate();
    },
  });

  const updateSort = api.view.updateSort.useMutation({
    onMutate: async (updatedSort) => {
      try {
        // Only cancel sort-related queries, not table data queries
        await utils.view.getSorts.cancel({ viewId });

        // Save previous state - don't update optimistically here since it's done in handleUpdateSort
        const previousSorts = [...sorts];

        return { previousSorts };
      } catch (error) {
        return undefined;
      }
    },
    onError: (error, variables, context) => {
      if (context?.previousSorts) {
        setSorts(context.previousSorts);
      }
      console.error("Error updating sort:", error);
    },
    onSuccess: () => {
      // Refresh sorts data after successful update
      void utils.view.getSorts.invalidate({ viewId });
    },
    onSettled: async () => {
      // Also invalidate table data to trigger re-fetch with new sorting
      void utils.table.getById.invalidate();
    },
  });

  const deleteSort = api.view.deleteSort.useMutation({
    onMutate: async (deletedSort) => {
      try {
        // Only cancel sort-related queries
        await utils.view.getSorts.cancel({ viewId });

        // Save previous state
        const previousSorts = [...sorts];

        // Optimistically update UI
        const optimisticSorts = sorts
          .filter((s) => s.id !== deletedSort.id)
          .map((s, index) => ({ ...s, order: index }));
        setSorts(optimisticSorts);

        return { previousSorts };
      } catch (error) {
        return undefined;
      }
    },
    onError: (error, variables, context) => {
      if (context?.previousSorts) {
        setSorts(context.previousSorts);
      }
      console.error("Error deleting sort:", error);
    },
    onSuccess: async () => {
      // Refresh sorts data
      await utils.view.getSorts.invalidate({ viewId });
      // Immediately refresh table data to show default order
      await utils.table.getById.invalidate();
    },
    onSettled: async () => {
      // Ensure table data is refreshed
      await utils.table.getById.invalidate();
    },
  });

  const handleAddSort = () => {
    if (fields.length === 0) return;

    // Optimistically update local state with completely empty sort
    const tempId = `temp-${Date.now()}`;
    const optimisticSort: Sort = {
      id: tempId,
      viewId,
      fieldId: "", // Empty field ID
      direction: "" as Direction, // Empty direction - user must select
      order: sorts.length,
      field: { id: "", name: "", type: "text", order: 0, tableId: "" }, // Placeholder field
    };
    setSorts([...sorts, optimisticSort]);

    // Don't send mutation until user selects both field and direction
  };

  const handleUpdateSort = (action: UpdateSortAction) => {
    const sort = sorts.find((s) => s.id === action.sortId);
    if (!sort) return;

    const updatedSort: Sort = {
      ...sort,
      fieldId: action.type === "fieldId" ? action.value : sort.fieldId,
      direction: action.type === "direction" ? action.value : sort.direction,
    };

    // Optimistically update local state
    setSorts(sorts.map((s) => (s.id === action.sortId ? updatedSort : s)));

    // If this is a new sort (temp ID), check if both field and direction are selected
    if (sort.id.startsWith("temp-")) {
      if (updatedSort.fieldId && updatedSort.direction) {
        // Both field and direction selected, create the sort
        // Calculate the correct order based on existing sorts (excluding temp ones)
        const existingSorts = sorts.filter((s) => !s.id.startsWith("temp-"));
        const correctOrder = existingSorts.length;

        addSort.mutate({
          viewId,
          fieldId: updatedSort.fieldId,
          direction: updatedSort.direction,
          order: correctOrder,
        });
      }
      // If only one is selected, just update local state and wait for both
    } else {
      // For existing sorts, update them immediately
      const mutationInput: SortMutationInput = {
        id: updatedSort.id,
        fieldId: updatedSort.fieldId,
        direction: updatedSort.direction,
        order: updatedSort.order,
      };

      // Send mutation
      updateSort.mutate(mutationInput);
    }
  };

  const handleDeleteSort = (sortId: string) => {
    const deletedSort = sorts.find((s) => s.id === sortId);
    if (!deletedSort) return;

    // Optimistically update local state
    const updatedSorts = sorts
      .filter((s) => s.id !== sortId)
      .map((s, index) => ({
        ...s,
        order: index,
      }));
    setSorts(updatedSorts);

    // If it's a temporary sort (not saved yet), just remove it locally
    if (sortId.startsWith("temp-")) {
      // If this was the last sort, refresh table data to show default order
      if (updatedSorts.length === 0) {
        void utils.table.getById.invalidate();
      }
      return;
    }

    // Send delete mutation for saved sorts
    deleteSort.mutate({ id: sortId });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(sorts);
    const [reorderedItem] = items.splice(result.source.index, 1);
    if (!reorderedItem) return;

    items.splice(result.destination.index, 0, reorderedItem);

    // Update orders
    const updatedSorts = items.map((item, index) => ({
      ...item,
      order: index,
    }));

    // Optimistically update local state
    setSorts(updatedSorts);

    // Update all sorts with new orders
    updatedSorts.forEach((sort, index) => {
      const mutationInput: SortMutationInput = {
        id: sort.id,
        fieldId: sort.fieldId,
        direction: sort.direction,
        order: index,
      };
      updateSort.mutate(mutationInput, {
        onSuccess: () => {
          if (index === updatedSorts.length - 1) {
            // Refresh sorts data after all updates are done - table data will auto-refetch
            void utils.view.getSorts.invalidate({ viewId });
          }
        },
      });
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Sort</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sorts">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex flex-col gap-2"
            >
              {sorts.map((sort, index) => (
                <Draggable key={sort.id} draggableId={sort.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="flex items-center gap-2 rounded-md border p-2"
                    >
                      <ArrowUpDown className="h-4 w-4 text-gray-400" />

                      {/* Field selector */}
                      <Select
                        value={sort.fieldId || undefined}
                        onValueChange={(value) =>
                          handleUpdateSort({
                            type: "fieldId",
                            sortId: sort.id,
                            value,
                          })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Direction selector */}
                      <Select
                        value={sort.direction || undefined}
                        onValueChange={(value: Direction) =>
                          handleUpdateSort({
                            type: "direction",
                            sortId: sort.id,
                            value,
                          })
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Select order" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">Ascending</SelectItem>
                          <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSort(sort.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={handleAddSort}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add sort
      </Button>
    </div>
  );
}
