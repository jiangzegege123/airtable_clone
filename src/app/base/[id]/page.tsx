"use client";

import { redirect, useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Plus, Search, Filter, SortAsc, Grid, Database } from "lucide-react";
import { Input } from "~/components/ui/input";
import { TableView } from "~/components/table/TableView";
import type { Column } from "~/components/table/TableView";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useToast } from "~/components/ui/use-toast";
import { Navbar } from "~/components/layout/Navbar";
import { TableTab } from "~/components/ui/table/table-tab";

interface TableRow {
  id: string;
  [key: string]: string | number | null;
}

const initialColumns: Column[] = [
  { id: "approvalId", name: "Approval ID", type: "text", width: 180 },
  { id: "tasks", name: "Tasks", type: "text", width: 240 },
];

const sampleRows: TableRow[] = [
  { id: "1", approvalId: "APR001", tasks: "Brainstorming Session" },
  { id: "2", approvalId: "APR002", tasks: "Draft Social Media Posts" },
  { id: "3", approvalId: "APR003", tasks: "Video Editing" },
  { id: "4", approvalId: "APR004", tasks: "Content Calendar Review" },
  { id: "5", approvalId: "APR005", tasks: "" },
];

export default function BasePage() {
  const params = useParams();
  const router = useRouter();
  const baseId = params.id as string;
  const { toast } = useToast();
  const utils = api.useUtils();

  // Fetch session and base data
  const { data: session, isLoading: isLoadingSession } =
    api.auth.getSession.useQuery();
  const {
    data: tables = [],
    isLoading: isLoadingTables,
    error: tablesError,
  } = api.table.list.useQuery(
    { baseId },
    {
      enabled: !!session?.user,
      retry: false,
    },
  );

  const createTable = api.table.create.useMutation({
    onSuccess: () => {
      toast({
        title: "Table created successfully",
        duration: 2000,
      });
      // Refresh tables list
      void utils.table.list.invalidate({ baseId });
    },
    onError: (error) => {
      toast({
        title: "Error creating table",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTable = api.table.delete.useMutation({
    onSuccess: () => {
      toast({
        title: "Table deleted successfully",
        duration: 2000,
      });
      // Refresh tables list
      void utils.table.list.invalidate({ baseId });
    },
    onError: (error) => {
      toast({
        title: "Error deleting table",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<TableRow[]>(sampleRows);
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  // Set initial selected table and update URL
  useEffect(() => {
    const firstTable = tables[0];
    if (tables.length > 0 && firstTable && !selectedTable) {
      setSelectedTable(firstTable.id);
      router.replace(`/base/${baseId}/${firstTable.id}`);
    }
  }, [tables, selectedTable, baseId, router]);

  // Handle table selection
  const handleTableSelect = (tableId: string) => {
    setSelectedTable(tableId);
    router.replace(`/base/${baseId}/${tableId}`);
  };

  useEffect(() => {
    if (!isLoadingSession && !session?.user) {
      redirect("/");
    }
  }, [session, isLoadingSession]);

  if (isLoadingSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="mt-2 text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  if (isLoadingTables) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="mt-2 text-sm text-gray-500">Loading tables...</p>
      </div>
    );
  }

  if (tablesError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <h3 className="text-lg font-medium text-red-800">
            Error loading tables
          </h3>
          <p className="mt-1 text-sm text-red-600">{tablesError.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const handleAddRow = () => {
    const newRow: TableRow = {
      id: (rows.length + 1).toString(),
      name: "",
      age: null,
    };
    setRows([...rows, newRow]);
  };

  const handleAddColumn = () => {
    const newColumnId = `column${columns.length + 1}`;
    const newColumn: Column = {
      id: newColumnId,
      name: `Column ${columns.length + 1}`,
      type: "text",
    };
    setColumns((currentColumns) => [...currentColumns, newColumn]);

    // Add the new column to existing rows with null values
    setRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        [newColumnId]: null,
      })),
    );
  };

  const handleUpdateCell = (
    rowId: string,
    columnId: string,
    value: string | number | null,
  ) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [columnId]: value,
            }
          : row,
      ),
    );
  };

  const handleAddTable = () => {
    const name = prompt("Enter table name:");
    if (!name) return;

    void createTable.mutate({
      baseId,
      name,
    });
  };

  const handleDeleteTable = (tableId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this table? This action cannot be undone.",
      )
    ) {
      deleteTable.mutate({ id: tableId, baseId });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar showBaseInfo baseId={baseId} />

      {/* Table Tabs */}
      <div className="bg-[#59427F]">
        <div className="flex h-12 items-center gap-2 px-4">
          <Tabs
            value={selectedTable ?? undefined}
            onValueChange={handleTableSelect}
            className="h-full flex-1"
          >
            <TabsList className="h-full bg-transparent">
              {tables.map((table) => (
                <TableTab
                  key={table.id}
                  id={table.id}
                  name={table.name}
                  onDelete={handleDeleteTable}
                />
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-white hover:bg-[#7456A5] hover:text-white"
            onClick={handleAddTable}
          >
            <Plus className="h-4 w-4" />
            Add table
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex h-12 items-center justify-between gap-4 border-b px-4 lg:px-6">
        <Button variant="ghost" size="sm" className="flex items-center gap-1">
          <Grid className="h-4 w-4" />
          Views
        </Button>
        <Button variant="ghost" size="sm" className="flex items-center gap-1">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
        <Button variant="ghost" size="sm" className="flex items-center gap-1">
          <SortAsc className="h-4 w-4" />
          Sort
        </Button>

        {/* Search */}
        <div className="flex-1">
          <div className="relative w-full max-w-md">
            <Search className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input className="pl-8" placeholder="Search..." type="search" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1">
        {selectedTable && (
          <TableView
            columns={columns}
            rows={rows}
            onAddRow={handleAddRow}
            onAddColumn={handleAddColumn}
            onUpdateCell={handleUpdateCell}
          />
        )}
      </div>
    </div>
  );
}
