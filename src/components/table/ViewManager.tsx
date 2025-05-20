import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { Column } from "./TableView";
import type {
  TableView,
  ColumnFilter,
  ColumnSort,
  FilterOperator,
} from "~/types/table";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface ViewManagerProps {
  columns: Column[];
  currentView: TableView | null;
  onSaveView: (view: Omit<TableView, "id">) => void;
  onUpdateView: (view: TableView) => void;
}

export function ViewManager({
  columns,
  currentView,
  onSaveView,
  onUpdateView,
}: ViewManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewName, setViewName] = useState(currentView?.name ?? "");
  const [filters, setFilters] = useState<ColumnFilter[]>(
    currentView?.filters ?? [],
  );
  const [sorts, setSorts] = useState<ColumnSort[]>(currentView?.sorts ?? []);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(
    currentView?.hiddenColumns ?? [],
  );

  const handleAddFilter = () => {
    setFilters([
      ...filters,
      { columnId: columns[0]?.id ?? "", operator: "equals", value: "" },
    ]);
  };

  const handleAddSort = () => {
    setSorts([...sorts, { columnId: columns[0]?.id ?? "", direction: "asc" }]);
  };

  const handleSave = () => {
    if (!viewName) return;

    if (currentView) {
      onUpdateView({
        ...currentView,
        name: viewName,
        filters,
        sorts,
        hiddenColumns,
      });
    } else {
      onSaveView({
        name: viewName,
        tableId: "", // This will be set in the parent component
        filters,
        sorts,
        hiddenColumns,
      });
    }
    setIsOpen(false);
  };

  const getOperatorOptions = (columnType: string) => {
    const options: { value: FilterOperator; label: string }[] = [];

    if (columnType === "number") {
      options.push(
        { value: "gt", label: "Greater than" },
        { value: "lt", label: "Less than" },
        { value: "equals", label: "Equals" },
      );
    } else {
      options.push(
        { value: "contains", label: "Contains" },
        { value: "notContains", label: "Does not contain" },
        { value: "equals", label: "Equals" },
      );
    }

    options.push(
      { value: "isEmpty", label: "Is empty" },
      { value: "isNotEmpty", label: "Is not empty" },
    );

    return options;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Manage View</Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure View</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>View Name</Label>
            <Input
              placeholder="Enter view name"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Filters</Label>
              <Button onClick={handleAddFilter} variant="outline" size="sm">
                Add Filter
              </Button>
            </div>

            {filters.map((filter, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={filter.columnId}
                  onValueChange={(value: string) => {
                    const newFilters = [...filters];
                    if (newFilters[index]) {
                      newFilters[index].columnId = value;
                      setFilters(newFilters);
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filter.operator}
                  onValueChange={(value: string) => {
                    const newFilters = [...filters];
                    if (newFilters[index]) {
                      newFilters[index].operator = value as FilterOperator;
                      setFilters(newFilters);
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {getOperatorOptions(
                      columns.find((col) => col.id === filter.columnId)?.type ??
                        "text",
                    ).map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!["isEmpty", "isNotEmpty"].includes(filter.operator) && (
                  <Input
                    placeholder="Value"
                    value={filter.value ?? ""}
                    onChange={(e) => {
                      const newFilters = [...filters];
                      newFilters[index].value = e.target.value;
                      setFilters(newFilters);
                    }}
                    type={
                      columns.find((col) => col.id === filter.columnId)
                        ?.type === "number"
                        ? "number"
                        : "text"
                    }
                  />
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newFilters = [...filters];
                    newFilters.splice(index, 1);
                    setFilters(newFilters);
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Sort</Label>
              <Button onClick={handleAddSort} variant="outline" size="sm">
                Add Sort
              </Button>
            </div>

            {sorts.map((sort, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={sort.columnId}
                  onValueChange={(value: string) => {
                    const newSorts = [...sorts];
                    if (newSorts[index]) {
                      newSorts[index].columnId = value;
                      setSorts(newSorts);
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sort.direction}
                  onValueChange={(value: "asc" | "desc") => {
                    const newSorts = [...sorts];
                    if (newSorts[index]) {
                      newSorts[index].direction = value;
                      setSorts(newSorts);
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">A → Z</SelectItem>
                    <SelectItem value="desc">Z → A</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newSorts = [...sorts];
                    newSorts.splice(index, 1);
                    setSorts(newSorts);
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <Label>Visible Columns</Label>
            <div className="grid grid-cols-3 gap-4">
              {columns.map((column) => (
                <div key={column.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`col-${column.id}`}
                    checked={!hiddenColumns.includes(column.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setHiddenColumns(
                          hiddenColumns.filter((id) => id !== column.id),
                        );
                      } else {
                        setHiddenColumns([...hiddenColumns, column.id]);
                      }
                    }}
                  />
                  <Label htmlFor={`col-${column.id}`}>{column.name}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {currentView ? "Update View" : "Save View"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
