"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useEffect, useState, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Plus, Search, Filter, SortAsc, Grid, Database } from "lucide-react";
import { Input } from "~/components/ui/input";
import { TableView } from "~/components/table/TableView";
import type { Column } from "~/components/table/TableView";
import { Tabs, TabsList } from "~/components/ui/tabs";
import { useToast } from "~/components/ui/use-toast";
import { Navbar } from "~/components/layout/Navbar";
import { TableTab } from "~/components/ui/table/table-tab";
import { faker } from "@faker-js/faker";

interface TableRow {
  id: string;
  [key: string]: string | number | null;
}

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const baseId = params.id as string;
  const tableId = params.tableId as string;
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
    onSuccess: (_, variables) => {
      toast({
        title: "Table deleted successfully",
        duration: 2000,
      });
      // Refresh tables list
      void utils.table.list.invalidate({ baseId });
      // If the deleted table was the selected one,跳转到base页
      if (variables.id === tableId) {
        router.replace(`/base/${baseId}`);
      }
    },
    onError: (error) => {
      toast({
        title: "Error deleting table",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [rows, setRows] = useState<TableRow[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [initialized, setInitialized] = useState(false);

  // 新增缓存引用
  const tableCache = useRef<
    Record<string, { columns: Column[]; rows: TableRow[] }>
  >({});

  // 默认字段
  const defaultColumns: Column[] = [
    { id: "name", name: "Name", type: "text", width: 160 },
    { id: "email", name: "Email", type: "text", width: 220 },
    { id: "phone", name: "Phone", type: "text", width: 140 },
    { id: "address", name: "Address", type: "text", width: 260 },
  ];

  // 生成假数据
  const generateFakeRows = (count: number): TableRow[] => {
    return Array.from({ length: count }).map((_, i) => ({
      id: (i + 1).toString(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      address: faker.location.streetAddress(),
    }));
  };

  // Fetch table data when tableId changes
  const { data: tableData, isLoading: isLoadingTableData } =
    api.table.getById.useQuery(
      { id: tableId },
      {
        enabled: !tableCache.current[tableId] && !!tableId,
      },
    );

  // 修改 useEffect，优先从缓存读取
  useEffect(() => {
    if (!initialized) {
      // 优先查缓存
      const cached = tableCache.current[tableId];
      if (cached) {
        setColumns(cached.columns);
        setRows(cached.rows);
        setInitialized(true);
        return;
      }
      // 没缓存再走原逻辑
      if (!tableData?.columns?.length) {
        setColumns(defaultColumns);
        setRows(generateFakeRows(10));
        // 写入缓存
        tableCache.current[tableId] = {
          columns: defaultColumns,
          rows: generateFakeRows(10),
        };
        setInitialized(true);
      } else if (tableData?.columns?.length) {
        setColumns(tableData.columns as Column[]);
        setRows(tableData.rows);
        // 写入缓存
        tableCache.current[tableId] = {
          columns: tableData.columns as Column[],
          rows: tableData.rows,
        };
        setInitialized(true);
      }
    }
  }, [tableData, initialized, tableId]);

  // Set up cell update mutation
  const updateCellMutation = api.table.updateCell.useMutation({
    onError: (error) => {
      toast({
        title: "Error updating cell",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isLoadingSession && !session?.user) {
      router.replace("/");
    }
  }, [session, isLoadingSession, router]);

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

  // 在 setRows/setColumns 的地方同步更新缓存
  const setRowsAndCache = (newRows: TableRow[]) => {
    setRows(newRows);
    tableCache.current[tableId] = {
      columns,
      rows: newRows,
    };
  };
  const setColumnsAndCache = (newColumns: Column[]) => {
    setColumns(newColumns);
    tableCache.current[tableId] = {
      columns: newColumns,
      rows,
    };
  };

  // 修改 handleAddRow、handleAddColumn、handleUpdateCell 调用 setRowsAndCache/setColumnsAndCache
  const handleAddRow = () => {
    const newRow: TableRow = {
      id: (rows.length + 1).toString(),
      name: "",
      age: null,
    };
    setRowsAndCache([...rows, newRow]);
  };
  const handleAddColumn = () => {
    const newColumnId = `column${columns.length + 1}`;
    const newColumn: Column = {
      id: newColumnId,
      name: `Column ${columns.length + 1}`,
      type: "text",
    };
    const newColumns = [...columns, newColumn];
    setColumnsAndCache(newColumns);
    setRowsAndCache(
      rows.map((row) => ({
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
    const newRows = rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            [columnId]: value,
          }
        : row,
    );
    setRowsAndCache(newRows);
    const column = columns.find((col) => col.id === columnId);
    if (!column || !tableId) return;
    updateCellMutation.mutate({
      tableId: tableId,
      recordId: rowId,
      fieldName: column.name,
      value,
    });
  };

  const handleAddTable = () => {
    const name = prompt("Enter table name:");
    if (!name) return;
    void createTable.mutate({
      baseId,
      name,
    });
  };

  const handleDeleteTable = (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this table? This action cannot be undone.",
      )
    ) {
      deleteTable.mutate({ id, baseId });
    }
  };

  const handleTableSelect = (id: string) => {
    if (id === tableId) return;
    router.push(`/base/${baseId}/${id}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar showBaseInfo baseId={baseId} />
      {/* Table Tabs */}
      <div className="bg-[#59427F]">
        <div className="flex h-12 items-center gap-2 px-4">
          <Tabs
            value={tableId}
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
        {!tableCache.current[tableId] && isLoadingTableData ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="ml-2 text-sm text-gray-500">Loading table data...</p>
          </div>
        ) : tableId ? (
          <TableView
            columns={columns}
            rows={rows}
            onAddRow={handleAddRow}
            onAddColumn={handleAddColumn}
            onUpdateCell={handleUpdateCell}
          />
        ) : tables.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Database className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-lg font-medium text-gray-500">
              No tables found
            </p>
            <p className="text-sm text-gray-400">
              Create a new table to get started
            </p>
            <Button className="mt-4" onClick={handleAddTable}>
              <Plus className="mr-2 h-4 w-4" />
              Create Table
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
