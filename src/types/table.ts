export type FilterOperator =
  | "gt"
  | "lt" // number comparisons
  | "isEmpty"
  | "isNotEmpty"
  | "contains"
  | "notContains"
  | "equals"; // text comparisons

export type SortDirection = "asc" | "desc";

export interface ColumnFilter {
  columnId: string;
  operator: FilterOperator;
  value?: string | number; // optional for isEmpty/isNotEmpty
}

export interface ColumnSort {
  columnId: string;
  direction: SortDirection;
}

export interface TableView {
  id: string;
  name: string;
  tableId: string;
  filters: ColumnFilter[];
  sorts: ColumnSort[];
  hiddenColumns: string[]; // store hidden column IDs
}
