import { Plus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { useState, useRef } from "react";

interface FilterPanelProps {
  tableId: string;
  viewId: string;
  onClose: (event?: React.MouseEvent) => void;
}

interface Filter {
  id: string;
  fieldId: string;
  operator:
    | "contains"
    | "notContains"
    | "equals"
    | "isEmpty"
    | "isNotEmpty"
    | "greaterThan"
    | "lessThan";
  value: string | null;
}

const TEXT_OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Does not contain" },
  { value: "equals", label: "Equals" },
  { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" },
];

const NUMBER_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "greaterThan", label: "Greater than" },
  { value: "lessThan", label: "Less than" },
  { value: "isEmpty", label: "Is empty" },
  { value: "isNotEmpty", label: "Is not empty" },
];

export function FilterPanel({ tableId, viewId, onClose }: FilterPanelProps) {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [pendingValues, setPendingValues] = useState<Record<string, string>>(
    {},
  );
  const utils = api.useUtils();
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Fetch fields for the current table
  const { data: fields = [] } = api.field.list.useQuery(
    { tableId },
    {
      enabled: !!tableId,
    },
  );

  // Fetch existing filters for the view
  const { data: existingFilters = [] } = api.view.getFilters.useQuery(
    { viewId },
    {
      enabled: !!viewId,
    },
  );

  const addFilter = api.view.addFilter.useMutation({
    onSuccess: () => {
      void utils.view.getFilters.invalidate({ viewId });
      void utils.table.getById.invalidate();
    },
  });

  const updateFilter = api.view.updateFilter.useMutation({
    onSuccess: () => {
      void utils.view.getFilters.invalidate({ viewId });
      void utils.table.getById.invalidate();
    },
  });

  const deleteFilter = api.view.deleteFilter.useMutation({
    onSuccess: () => {
      void utils.view.getFilters.invalidate({ viewId });
      void utils.table.getById.invalidate();
    },
  });

  const handleAddFilter = () => {
    if (fields.length === 0) return;
    addFilter.mutate({
      viewId,
      fieldId: fields[0].id,
      operator: "contains",
      value: "",
    });
  };

  const handleUpdateFilter = (
    filterId: string,
    field: "fieldId" | "operator" | "value",
    value: string,
  ) => {
    const filter = existingFilters.find((f) => f.id === filterId);
    if (!filter) return;

    // For value changes, update immediately but don't commit to database
    if (field === "value") {
      setPendingValues((prev) => ({ ...prev, [filterId]: value }));
      return;
    }

    // For field and operator changes, update immediately
    // First, get the current value (either pending or existing)
    const currentValue = pendingValues[filterId] ?? filter.value ?? "";

    const isValidOperator = (op: string): op is Filter["operator"] => {
      return [
        "contains",
        "notContains",
        "equals",
        "isEmpty",
        "isNotEmpty",
        "greaterThan",
        "lessThan",
      ].includes(op);
    };

    updateFilter.mutate({
      id: filterId,
      fieldId: field === "fieldId" ? String(value) : filter.fieldId,
      operator:
        field === "operator" && isValidOperator(value)
          ? value
          : filter.operator,
      value: currentValue ? String(currentValue) : undefined,
    });

    // Clear pending value since we've committed it
    setPendingValues((prev) => {
      const newPending = { ...prev };
      delete newPending[filterId];
      return newPending;
    });
  };

  const commitValueChange = (filterId: string) => {
    const filter = existingFilters.find((f) => f.id === filterId);
    const pendingValue = pendingValues[filterId];

    if (!filter || pendingValue === undefined) return;

    updateFilter.mutate({
      id: filterId,
      fieldId: filter.fieldId,
      operator: filter.operator,
      value: String(pendingValue ?? ""),
    });

    // Clear pending value
    setPendingValues((prev) => {
      const newPending = { ...prev };
      delete newPending[filterId];
      return newPending;
    });
  };

  const handleDeleteFilter = (filterId: string) => {
    deleteFilter.mutate({ id: filterId });
  };

  return (
    <div className="flex w-[600px] flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Filters</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {existingFilters.map((filter) => (
          <div
            key={filter.id}
            className="flex items-center gap-2 rounded-md border p-2"
          >
            {/* Field selector */}
            <Select
              value={typeof filter.fieldId === "string" ? filter.fieldId : ""}
              onValueChange={(value) =>
                handleUpdateFilter(filter.id, "fieldId", value)
              }
            >
              <SelectTrigger className="w-[120px] flex-shrink-0">
                <SelectValue>
                  {fields.find((f) => f.id === filter.fieldId)?.name ??
                    "Select field"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {fields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Operator selector */}
            <Select
              value={
                typeof filter.operator === "string"
                  ? filter.operator
                  : "contains"
              }
              onValueChange={(value) =>
                handleUpdateFilter(filter.id, "operator", value)
              }
            >
              <SelectTrigger className="w-[140px] flex-shrink-0">
                <SelectValue>
                  {(() => {
                    const field = fields.find((f) => f.id === filter.fieldId);
                    const operators =
                      field?.type === "number"
                        ? NUMBER_OPERATORS
                        : TEXT_OPERATORS;
                    return (
                      operators.find((op) => op.value === filter.operator)
                        ?.label ?? "Select operator"
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const field = fields.find((f) => f.id === filter.fieldId);
                  const operators =
                    field?.type === "number"
                      ? NUMBER_OPERATORS
                      : TEXT_OPERATORS;
                  return operators.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>

            {/* Value input - only show for operators that need a value */}
            {filter.operator !== "isEmpty" &&
              filter.operator !== "isNotEmpty" && (
                <Input
                  type={(() => {
                    const field = fields.find((f) => f.id === filter.fieldId);
                    return field?.type === "number" ? "number" : "text";
                  })()}
                  value={
                    pendingValues[filter.id] ??
                    (typeof filter.value === "string" ? filter.value : "")
                  }
                  onChange={(e) =>
                    handleUpdateFilter(filter.id, "value", e.target.value)
                  }
                  onBlur={() => commitValueChange(filter.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitValueChange(filter.id);
                    }
                  }}
                  placeholder={(() => {
                    const field = fields.find((f) => f.id === filter.fieldId);
                    return field?.type === "number"
                      ? "Enter number..."
                      : "Enter text...";
                  })()}
                  className="min-w-[200px] flex-1"
                />
              )}

            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              onClick={() => handleDeleteFilter(filter.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={handleAddFilter}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add filter
      </Button>
    </div>
  );
}
