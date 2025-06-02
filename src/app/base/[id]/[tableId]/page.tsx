"use client";

import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import { Navbar } from "~/components/layout/Navbar";
import { MemoizedTableView } from "~/components/table/TableView";
import { ViewList } from "~/components/table/ViewList";
import { FilterPanel } from "~/components/table/FilterPanel";
import { SortPanel } from "~/components/table/SortPanel";
import { Tabs, TabsList } from "~/components/ui/tabs";
import { useToast } from "~/components/ui/use-toast";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Filter,
  ChevronDown,
  Plus,
  Search,
  CirclePlay,
  Database,
  X,
  Grid,
  SortAsc,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

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
  const [activeViewId, setActiveViewId] = useState<string>();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [showViewsSidebar, setShowViewsSidebar] = useState(false);

  const loadingViewIdRef = useRef<string | undefined>(undefined);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const sortPanelRef = useRef<HTMLDivElement>(null);

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

  // Fetch views for the current table
  const { data: views = [] } = api.view.list.useQuery(
    { tableId },
    {
      enabled: !!tableId && !!session?.user,
    },
  );

  // Auto-select default view when views are loaded
  useEffect(() => {
    if (!activeViewId && views.length > 0 && tableId) {
      // Find the default view first
      const defaultView = views.find((view) => view.isDefault);
      if (defaultView) {
        setActiveViewId(defaultView.id);
      } else if (views[0]) {
        // If no default view, select the first one
        setActiveViewId(views[0].id);
      }
    }
  }, [views, activeViewId, tableId]);

  // Reset activeViewId when tableId changes
  useEffect(() => {
    setActiveViewId(undefined);
  }, [tableId]);

  // Close panels when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if the click is inside any select dropdown (Radix UI portals these to body)
      const isClickInsideSelectContent =
        target instanceof Element &&
        (target.closest("[data-radix-select-content]") ??
          target.closest("[data-radix-popper-content-wrapper]") ??
          target.closest("[data-radix-select-viewport]") ??
          target.closest("[data-radix-select-item]") ??
          target.closest('[role="listbox"]') ??
          target.closest('[role="option"]') ??
          target.closest('[data-state="open"]') ??
          // Also check for any element with radix in the class or data attributes
          target.getAttribute("data-radix-collection-item") !== null ??
          target.closest("[data-radix-collection-item]"));

      // Don't close panels if clicking inside select dropdowns
      if (isClickInsideSelectContent) {
        return;
      }

      // Check if filter panel should close
      if (showFilterPanel) {
        const isClickInsideFilterButton =
          filterButtonRef.current?.contains(target);
        const isClickInsideFilterPanel =
          filterPanelRef.current?.contains(target);

        if (!isClickInsideFilterButton && !isClickInsideFilterPanel) {
          setShowFilterPanel(false);
        }
      }

      // Check if sort panel should close
      if (showSortPanel) {
        const isClickInsideSortButton = sortButtonRef.current?.contains(target);
        const isClickInsideSortPanel = sortPanelRef.current?.contains(target);

        if (!isClickInsideSortButton && !isClickInsideSortPanel) {
          setShowSortPanel(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFilterPanel, showSortPanel]);

  const createTable = api.table.create.useMutation({
    onSuccess: () => {
      toast({
        title: "Table created successfully",
        duration: 2000,
        variant: "success",
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
        variant: "success",
      });
      // Refresh tables list
      void utils.table.list.invalidate({ baseId });
      // If the deleted table was the selected one, redirect to base page
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

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 🚀 Use tRPC useInfiniteQuery for better infinite scrolling
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isTableDataLoading,
    error: tableError,
  } = api.table.getById.useInfiniteQuery(
    {
      id: tableId,
      limit: 50, // Fetch 50 items per page
      ...(activeViewId ? { viewId: activeViewId } : {}),
      ...(searchTerm ? { searchTerm: searchTerm.trim() } : {}),
    },
    {
      enabled: !!tableId && !!activeViewId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: false,
    },
  );

  // Flatten all pages into a single array of rows
  const rows = useMemo(() => {
    if (!infiniteData?.pages) return [];
    return infiniteData.pages.flatMap((page) => page.rows);
  }, [infiniteData]);

  // Get columns from the first page
  const columns = useMemo(() => {
    if (!infiniteData?.pages?.[0]) return [];
    const allColumns = infiniteData.pages[0].columns.map((col) => ({
      ...col,
      type: col.type as "text" | "number",
    }));
    return allColumns;
  }, [infiniteData]);

  // Monitor query loading state
  useEffect(() => {
    if (
      !isTableDataLoading &&
      infiniteData &&
      (loadingViewIdRef.current === undefined ||
        loadingViewIdRef.current === activeViewId)
    ) {
      setIsViewLoading(false);
      loadingViewIdRef.current = undefined;
    }
  }, [isTableDataLoading, infiniteData, activeViewId]);

  // Update loading state check
  const hasData =
    infiniteData?.pages?.[0]?.columns &&
    infiniteData.pages[0].columns.length > 0;
  const isLoading =
    isTableDataLoading ||
    isViewLoading ||
    isSearching ||
    (!hasData && !!tableId && !!activeViewId);

  // Add effect to handle search term changes
  useEffect(() => {
    // Clear previous timeout
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Set searching state
    setIsSearching(true);

    // Debounce search
    searchDebounceRef.current = setTimeout(() => {
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchTerm, tableId, activeViewId]);

  // Remove the client-side filtering
  const filteredRows = rows;

  // Memoize filtered columns to prevent unnecessary re-renders
  const visibleColumns = useMemo(() => {
    return columns.filter((col) => !col.hidden);
  }, [columns]);

  // Force refresh current table data after cell update
  const updateCellMutation = api.table.updateCell.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid optimistic update conflicts
      await utils.table.getById.cancel();

      // Snapshot the previous value for rollback
      const previousData = utils.table.getById.getInfiniteData({
        id: variables.tableId,
        limit: 50,
        ...(activeViewId ? { viewId: activeViewId } : {}),
        ...(searchTerm ? { searchTerm: searchTerm.trim() } : {}),
      });

      // Optimistically update the frontend data
      utils.table.getById.setInfiniteData(
        {
          id: variables.tableId,
          limit: 50,
          ...(activeViewId ? { viewId: activeViewId } : {}),
          ...(searchTerm ? { searchTerm: searchTerm.trim() } : {}),
        },
        (oldData) => {
          if (!oldData) return oldData;

          // Find the column being updated
          const column = columns.find(
            (col) => col.name === variables.fieldName,
          );
          if (!column) return oldData;

          // Update the data optimistically
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              rows: page.rows.map((row) => {
                if (row.id === variables.recordId) {
                  return {
                    ...row,
                    [column.id]: variables.value,
                  };
                }
                return row;
              }),
            })),
          };
        },
      );

      // Return context for error recovery
      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousData) {
        utils.table.getById.setInfiniteData(
          {
            id: variables.tableId,
            limit: 50,
            ...(activeViewId ? { viewId: activeViewId } : {}),
            ...(searchTerm ? { searchTerm: searchTerm.trim() } : {}),
          },
          context.previousData,
        );
      }

      toast({
        title: "Error updating cell",
        description: error.message ?? "An unknown error occurred",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      // Success - now refetch to get correct sorting/filtering
      // Use invalidate to trigger a fresh fetch that respects current view settings
      void utils.table.getById.invalidate();

      toast({
        title: "Cell updated successfully",
        duration: 1000,
        variant: "success",
      });
    },
  });

  // Simplified addRowMutation with infinite query invalidation
  const addRowMutation = api.table.addRow.useMutation({
    onSuccess: async () => {
      toast({
        title: "Row added successfully",
        duration: 2000,
        variant: "success",
      });
      // Invalidate and refetch the infinite query
      await utils.table.getById.invalidate().catch(console.error);
      // 自动跳到最后一页
      while (hasNextPage) {
        await fetchNextPage();
      }
    },
    onError: (error) => {
      toast({
        title: "Error adding row",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addColumnMutation = api.table.addColumn.useMutation({
    onSuccess: () => {
      toast({
        title: "Column added successfully",
        duration: 2000,
        variant: "success",
      });
      // Invalidate and refetch the infinite query
      void utils.table.getById.invalidate().catch(console.error);
    },
    onError: (error) => {
      toast({
        title: "Error adding column",
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

  const add100kRowsMutation = api.table.add100kRows.useMutation({
    onSuccess: () => {
      toast({
        title: "Added 100k rows successfully",
        duration: 2000,
        variant: "success",
      });
      // Refresh table data
      void utils.table.getById.invalidate({ id: tableId }).catch(console.error);
    },
    onError: (error) => {
      toast({
        title: "Error adding rows",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdd100kRows = () => {
    if (!tableId) return;
    add100kRowsMutation.mutate({ tableId });
  };

  // Update handleViewSelect function with proper loading state
  const handleViewSelect = (viewId: string) => {
    // Don't do anything if the same view is already selected
    if (viewId === activeViewId) {
      return;
    }

    // Set loading state and track the view being loaded
    setIsViewLoading(true);
    loadingViewIdRef.current = viewId;

    // Reset view state - useInfiniteQuery will handle the rest
    setActiveViewId(viewId);
  };

  // Modify handleAddColumn call to call backend API
  const handleAddColumn = () => {
    const columnName = `Column ${columns.length + 1}`;

    // Add column to the database
    addColumnMutation.mutate({
      tableId,
      name: columnName,
      type: "text",
    });
  };

  const handleUpdateCell = (
    rowId: string,
    columnId: string,
    value: string | number | null,
  ) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column || !tableId) return;
    updateCellMutation.mutate({
      tableId,
      recordId: rowId,
      fieldName: column.name,
      value: value,
    });
  };

  const handleAddTable = () => {
    const name = prompt("请输入新表的名称：");
    if (!name || !name.trim()) return;
    createTable.mutate({
      baseId,
      name: name.trim(),
    });
  };

  const handleDeleteTable = (id: string) => {
    deleteTable.mutate({ id, baseId });
  };

  const handleTableSelect = (id: string) => {
    router.push(`/base/${baseId}/${id}`);
  };

  const handleAddRow = () => {
    if (!tableId) return;

    // Use the simpler addRow mutation that generates fake data
    addRowMutation.mutate({
      tableId,
    });
  };

  if (isLoadingSession) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session?.user) {
    return null; // Will be redirected
  }

  if (tablesError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <Database className="h-12 w-12 text-red-300" />
        <p className="mt-4 text-lg font-medium text-red-600">
          Error loading tables
        </p>
        <p className="text-sm text-red-500">{tablesError.message}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <Navbar showBaseInfo baseId={baseId} />

      {/* Table Tabs Bar */}
      <div className="bg-[#59427F]">
        <div className="flex h-[35px] items-center gap-2 px-4">
          <Tabs
            value={tableId}
            onValueChange={handleTableSelect}
            className="h-full flex-1"
          >
            <TabsList className="h-[35px] bg-transparent">
              {tables.map((table) => (
                <div key={table.id} className="relative flex items-center">
                  <div
                    className={`flex h-[35px] cursor-pointer items-center gap-2 rounded-none border-x border-t border-transparent bg-transparent px-4 transition-colors ${
                      table.id === tableId
                        ? "rounded-t-lg border-b-0 border-white bg-white font-medium text-[#59427F]"
                        : "text-white hover:text-white/90"
                    }`}
                    onClick={() => handleTableSelect(table.id)}
                  >
                    <span className="relative z-10">{table.name}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Delete table"
                      className={`relative z-10 ml-1 cursor-pointer rounded-full p-0.5 transition-colors ${
                        table.id === tableId
                          ? "text-gray-500 hover:bg-gray-100"
                          : "text-white hover:bg-[#7456A5]"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(table.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          handleDeleteTable(table.id);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </TabsList>
          </Tabs>
          {tables.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-white hover:bg-[#7456A5] hover:text-white"
              onClick={handleAddTable}
            >
              <Plus className="h-4 w-4" />
              Add table
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="relative border-b bg-white px-6 py-2">
        <div className="flex h-[41px] items-center justify-between">
          {/* Left: Control Buttons */}
          <div className="flex items-center space-x-3">
            {/* Views Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowViewsSidebar(!showViewsSidebar)}
              className={showViewsSidebar ? "border-blue-200 bg-blue-50" : ""}
            >
              <Grid className="mr-2 h-4 w-4" />
              Views
            </Button>

            {/* Filter */}
            <div className="relative">
              <Button
                ref={filterButtonRef}
                variant="outline"
                size="sm"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={showFilterPanel ? "border-blue-200 bg-blue-50" : ""}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>

              {/* Filter Panel Dropdown */}
              {showFilterPanel && activeViewId && (
                <div
                  ref={filterPanelRef}
                  className="absolute top-full left-0 z-50 mt-2 w-[600px] rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                  <FilterPanel
                    viewId={activeViewId}
                    onClose={() => setShowFilterPanel(false)}
                    tableId={tableId}
                  />
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <Button
                ref={sortButtonRef}
                variant="outline"
                size="sm"
                onClick={() => setShowSortPanel(!showSortPanel)}
                className={showSortPanel ? "border-blue-200 bg-blue-50" : ""}
              >
                <SortAsc className="mr-2 h-4 w-4" />
                Sort
              </Button>

              {/* Sort Panel Dropdown */}
              {showSortPanel && activeViewId && (
                <div
                  ref={sortPanelRef}
                  className="absolute top-full left-0 z-50 mt-2 w-96 rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                  <SortPanel
                    viewId={activeViewId}
                    onClose={() => setShowSortPanel(false)}
                    tableId={tableId}
                  />
                </div>
              )}
            </div>

            {/* Add 100k Rows */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAdd100kRows}
              disabled={add100kRowsMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              {add100kRowsMutation.isPending ? "Adding..." : "Add 100k Rows"}
            </Button>
          </div>

          {/* Right: Search */}
          <div className="flex items-center">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search..."
                className="w-64 pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Views Sidebar */}
        {showViewsSidebar && (
          <div className="w-64 flex-shrink-0 border-r bg-gray-50">
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Views</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-200"
                  onClick={() => setShowViewsSidebar(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {views.length > 0 && (
                <ViewList
                  activeViewId={activeViewId}
                  onViewSelect={handleViewSelect}
                  tableId={tableId}
                />
              )}
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex flex-1 flex-col">
          {/* Table Content */}
          <div className="flex-1 overflow-hidden">
            {tableId ? (
              <div
                className="table-container h-full overflow-auto overscroll-none"
                style={{
                  overscrollBehavior: "contain",
                  WebkitOverflowScrolling: "touch",
                }}
                data-table-id={tableId}
              >
                <MemoizedTableView
                  columns={visibleColumns}
                  rows={filteredRows}
                  onAddRow={handleAddRow}
                  onAddColumn={handleAddColumn}
                  onUpdateCell={handleUpdateCell}
                  showAddRowButton={!hasNextPage}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                />
              </div>
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
      </div>
    </div>
  );
}
