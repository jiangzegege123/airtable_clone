"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useEffect, useState, useRef, useCallback } from "react";
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

// 定义表格数据的类型
interface TableData {
  table: {
    id: string;
    name: string;
    baseId: string;
  };
  columns: Column[];
  rows: TableRow[];
  pagination: {
    totalCount: number;
    hasMore: boolean;
  };
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

  const [rows, setRows] = useState<TableRow[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Add cache reference
  const tableCache = useRef<
    Record<string, { columns: Column[]; rows: TableRow[] }>
  >({});

  // Add pagination state
  const [skip, setSkip] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const tableBottomRef = useRef<HTMLDivElement>(null);
  // Add debounce tracking ref
  const lastLoadTimeRef = useRef<number>(0);
  // Add a ref to track the current tableId to detect changes
  const currentTableIdRef = useRef<string | null>(null);
  // Add a loading lock to prevent race conditions
  const isLoadingLockRef = useRef<boolean>(false);
  // Add a counter for temporary IDs to ensure uniqueness
  const tempIdCounterRef = useRef<number>(0);

  // Default fields
  const defaultColumns: Column[] = [
    { id: "name", name: "Name", type: "text", width: 160 },
    { id: "email", name: "Email", type: "text", width: 220 },
    { id: "phone", name: "Phone", type: "text", width: 140 },
    { id: "address", name: "Address", type: "text", width: 260 },
  ];

  // Helper functions to update rows and columns while updating cache
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

  // Generate mock data
  const generateFakeRows = (count: number): TableRow[] => {
    return Array.from({ length: count }).map((_, i) => ({
      id: (i + 1).toString(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      address: faker.location.streetAddress(),
    }));
  };

  // Query for loading more data
  const { data: tableData, isLoading: isLoadingTableData } =
    api.table.getById.useQuery(
      {
        id: tableId,
        skip: 0,
        take: 10,
        loadAll: false,
      },
      {
        enabled: !tableCache.current[tableId] && !!tableId,
      },
    );

  // Update row data, merge newly loaded data
  const loadMoreData = useCallback(async () => {
    // Early return conditions in a single block to simplify logic
    if (!tableId || !hasMore || isLoadingMore || isLoadingLockRef.current)
      return;

    // Add debounce check - only allow loading once every 500ms
    const now = Date.now();
    if (now - lastLoadTimeRef.current < 500) {
      console.log("Debouncing loadMoreData - too soon after last load");
      return;
    }

    // Set loading lock to prevent concurrent calls
    isLoadingLockRef.current = true;
    lastLoadTimeRef.current = now;

    try {
      setIsLoadingMore(true);
      console.log("Loading more data starting from", skip);
      const moreData = await utils.table.getById.fetch({
        id: tableId,
        skip,
        take: 10,
      });

      // Check if tableId changed during loading
      if (tableId !== currentTableIdRef.current) {
        console.log("Table ID changed during loading, aborting update");
        return;
      }

      if (moreData?.rows?.length) {
        // 更新行数据，合并新加载的数据
        const newRows = [...rows, ...moreData.rows];
        setRowsAndCache(newRows);

        // 更新分页状态
        setSkip(skip + moreData.rows.length);
        if (moreData.pagination) {
          setHasMore(moreData.pagination.hasMore);
          setTotalCount(moreData.pagination.totalCount);
        } else {
          setHasMore(false);
        }

        console.log("Loaded more data", {
          newRowsCount: moreData.rows.length,
          totalLoaded: newRows.length,
          hasMore: moreData.pagination?.hasMore,
        });
      } else {
        setHasMore(false);
        console.log("No more data to load");
      }
    } catch (error) {
      console.error(
        "Failed to load more data",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsLoadingMore(false);
      setTimeout(() => {
        isLoadingLockRef.current = false;
      }, 100);
    }
  }, [tableId, skip, hasMore, isLoadingMore, rows, utils.table.getById]);

  // Add function to force check if more data needs to be loaded
  const checkIfNeedMoreData = useCallback(() => {
    // Don't check if we're changing tables or already loading
    if (tableId !== currentTableIdRef.current || isLoadingLockRef.current) {
      return false;
    }

    // If we already loaded all data, no need to check further
    if (!hasMore) {
      console.log("No more data to load, skipping check");
      return false;
    }

    console.log("Checking if more data needs to be loaded");

    // Check if we're already loading or loaded too recently
    if (isLoadingMore || Date.now() - lastLoadTimeRef.current < 300) {
      console.log("Skip loading - already loading or loaded too recently");
      return false;
    }

    // Use more reliable selector, ".table-container" class might be more consistently present
    const tableContainer = document.querySelector(".table-container");

    if (!tableContainer || !tableBottomRef.current) {
      console.log("Check conditions not met", {
        hasContainer: !!tableContainer,
        hasBottomRef: !!tableBottomRef.current,
      });
      return false;
    }

    // Get container dimensions
    const { scrollTop, clientHeight, scrollHeight } = tableContainer;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;

    console.log("Container dimensions", {
      scrollTop,
      clientHeight,
      scrollHeight,
      scrollBottom,
      threshold: Math.min(300, clientHeight * 0.3), // Dynamic threshold, smaller screens use smaller threshold
    });

    // Calculate a dynamic threshold based on container height, smaller containers use smaller threshold but not exceeding 300px
    const threshold = Math.min(300, clientHeight * 0.3);

    // If content is not enough to fill screen or near bottom, load more
    if (scrollBottom < threshold) {
      console.log("Content not filling the view, loading more automatically");
      void loadMoreData();
      return true;
    }

    return false;
  }, [hasMore, isLoadingMore, loadMoreData, tableId]);

  // Set up infinite scroll listener
  const handleScroll = useCallback(
    (e: Event) => {
      // Don't process scroll during table ID change or loading
      if (tableId !== currentTableIdRef.current || isLoadingLockRef.current) {
        return;
      }

      // If we already loaded all data, don't trigger more loads
      if (!hasMore) {
        return;
      }

      // Don't try to prevent default in scroll events
      if (!tableBottomRef.current || isLoadingMore) {
        return;
      }

      // Check debounce timing - only proceed if we haven't loaded recently
      const now = Date.now();
      if (now - lastLoadTimeRef.current < 300) {
        return;
      }

      // Get scroll container
      const container = e.target as HTMLElement;
      if (!container) return;

      // Calculate if more data needs to be loaded
      const { scrollTop, clientHeight, scrollHeight } = container;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;

      // Use dynamic threshold, but not less than 50px
      const threshold = Math.max(50, clientHeight * 0.2);

      // Load more when distance to bottom is within threshold
      if (
        scrollBottom < threshold &&
        !isLoadingMore &&
        !isLoadingLockRef.current
      ) {
        console.log("Triggered loading more data");
        void loadMoreData();
      }
    },
    [hasMore, isLoadingMore, loadMoreData, tableId],
  );

  // Handle when table data is loaded successfully
  useEffect(() => {
    if (tableData && !initialized) {
      console.log("Table data received from server", tableData);

      // Set pagination info
      if (tableData.pagination) {
        setHasMore(tableData.pagination.hasMore);
        setTotalCount(tableData.pagination.totalCount);
        setSkip(10); // Initial load of 10 items, next load starts from 10th item
      }

      // Set table data
      if (tableData.columns?.length) {
        setColumns(tableData.columns as Column[]);
        setRows(tableData.rows);
        // Write to cache
        tableCache.current[tableId] = {
          columns: tableData.columns as Column[],
          rows: tableData.rows,
        };
        setInitialized(true);
      } else {
        // Use default values when no data
        setColumns(defaultColumns);
        setRows(generateFakeRows(10));
        // Write to cache
        tableCache.current[tableId] = {
          columns: defaultColumns,
          rows: generateFakeRows(10),
        };
        setInitialized(true);
      }

      // Mark data as just initialized, used to trigger first scroll check
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          // Nested requestAnimationFrame to ensure check after data rendering
          checkIfNeedMoreData();
        });
      });
    }
  }, [tableData, initialized, tableId, defaultColumns, checkIfNeedMoreData]);

  // Add special listener for first page load to ensure all DOM elements are loaded
  useEffect(() => {
    if (tableId && initialized) {
      // Use MutationObserver to monitor DOM changes
      const observer = new MutationObserver((mutations) => {
        // Check if more data needs to be loaded after DOM changes
        window.requestAnimationFrame(() => {
          checkIfNeedMoreData();
        });

        // Run once then disconnect observer
        observer.disconnect();
      });

      // Monitor table container changes
      const container = document.querySelector(".table-container");
      if (container) {
        observer.observe(container, {
          childList: true,
          subtree: true,
        });

        // Ensure not exceeding 5 seconds
        setTimeout(() => observer.disconnect(), 5000);
      }

      return () => observer.disconnect();
    }
  }, [tableId, initialized, checkIfNeedMoreData]);

  // Monitor tableId changes
  useEffect(() => {
    if (tableId) {
      console.log("Table ID changed, resetting state", {
        from: currentTableIdRef.current,
        to: tableId,
      });

      // Set the loading lock during table change to prevent any load operations
      isLoadingLockRef.current = true;

      // Update the current table ID ref
      currentTableIdRef.current = tableId;

      const cached = tableCache.current[tableId];
      if (cached) {
        // Load data from cache
        setColumns(cached.columns);
        setRows(cached.rows);
        setInitialized(true);

        // Set hasMore to false if we've loaded all data
        // This prevents triggering new loads when switching back to fully loaded tables
        if (cached.rows.length === totalCount) {
          setHasMore(false);
        }
      } else {
        // Reset state and wait for data load if no cache
        setInitialized(false);
        setSkip(0);
        setHasMore(true);
      }

      // Release the loading lock after a short delay to allow state to settle
      setTimeout(() => {
        isLoadingLockRef.current = false;
      }, 300);
    }
  }, [tableId, totalCount]);

  // Dedicated useEffect to check if more data needs to be loaded after first load
  useEffect(() => {
    // Only execute after table data is loaded for the first time
    if (initialized && rows.length > 0 && hasMore) {
      console.log(
        "Initial data load complete, checking if more data needs to be loaded",
      );
      // Use requestAnimationFrame to ensure DOM is updated
      window.requestAnimationFrame(() => {
        setTimeout(() => {
          // Force check scroll position
          const tableContainer = document.querySelector(".table-container");
          if (tableContainer) {
            const { scrollHeight, clientHeight } =
              tableContainer as HTMLElement;

            // If content is not enough to fill container, load more immediately
            if (scrollHeight <= clientHeight && hasMore) {
              console.log(
                "Content height not filling container, loading more data",
              );
              void loadMoreData();
            } else {
              checkIfNeedMoreData();
            }
          }
        }, 300);
      });
    }
  }, [initialized, rows.length, hasMore, checkIfNeedMoreData, loadMoreData]);

  // Register scroll event listener
  useEffect(() => {
    // Skip registering if we're in the middle of changing tables
    if (tableId !== currentTableIdRef.current || isLoadingLockRef.current) {
      return;
    }

    console.log("Registering scroll event");

    // Use requestAnimationFrame to ensure DOM is rendered
    const registerScrollEvent = () => {
      // Find table container
      const tableContainer = document.querySelector(".table-container");

      if (tableContainer) {
        console.log("Found table container, binding scroll event");

        // Use passive: true for better performance and add throttling with rAF
        let ticking = false;
        const throttledScroll = (e: Event) => {
          if (!ticking) {
            window.requestAnimationFrame(() => {
              handleScroll(e);
              ticking = false;
            });
            ticking = true;
          }
        };

        tableContainer.addEventListener("scroll", throttledScroll, {
          passive: true,
        });

        // For wheel events, we'll use a separate approach
        const handleWheel = (e: Event) => {
          // Skip during table change or if locked
          if (
            tableId !== currentTableIdRef.current ||
            isLoadingLockRef.current
          ) {
            return;
          }

          // If we already loaded all data, don't trigger more loads
          if (!hasMore) {
            return;
          }

          // Don't proceed if already loading or too soon after last load
          if (isLoadingMore || Date.now() - lastLoadTimeRef.current < 300) {
            return;
          }

          // Instead, we'll handle the scroll position manually if needed
          if (tableContainer instanceof HTMLElement) {
            const { scrollTop, scrollHeight, clientHeight } = tableContainer;
            const wheelEvent = e as WheelEvent;
            if (
              scrollTop + clientHeight >= scrollHeight - 30 &&
              wheelEvent.deltaY > 0
            ) {
              // We reached the bottom, just trigger loading more if needed
              if (!isLoadingMore && !isLoadingLockRef.current) {
                void loadMoreData();
              }
            }
          }
        };

        tableContainer.addEventListener("wheel", handleWheel, {
          passive: true, // Use passive: true to avoid browser warnings
        });

        // 初次加载时检查是否需要加载更多数据，但给状态一点时间稳定
        const timeoutId = setTimeout(() => {
          // Only check if we haven't loaded all data yet
          if (hasMore) {
            checkIfNeedMoreData();
          }
        }, 500);

        // Add a scroll position check timer to prevent cases where scroll event doesn't trigger
        const scrollCheckInterval = setInterval(() => {
          if (
            hasMore &&
            !isLoadingMore &&
            !isLoadingLockRef.current &&
            tableContainer instanceof HTMLElement
          ) {
            const { scrollTop, scrollHeight, clientHeight } = tableContainer;
            const scrollBottom = scrollHeight - scrollTop - clientHeight;

            if (scrollBottom < 100) {
              console.log("Scroll check interval triggered loading");
              void loadMoreData();
            }
          }
        }, 1000);

        return () => {
          console.log("Removing scroll event");
          tableContainer.removeEventListener("scroll", throttledScroll);
          tableContainer.removeEventListener("wheel", handleWheel);
          clearTimeout(timeoutId);
          clearInterval(scrollCheckInterval);
        };
      } else {
        console.log("Table container not found, waiting for DOM rendering");
        // If container not found, DOM might not be rendered yet, try again later
        const timeoutId = setTimeout(registerScrollEvent, 200);
        return () => clearTimeout(timeoutId);
      }
    };

    // Start registration process
    const cleanup = registerScrollEvent();
    return cleanup;
  }, [
    handleScroll,
    checkIfNeedMoreData,
    tableId,
    hasMore,
    isLoadingMore,
    loadMoreData,
  ]);

  // Monitor row data changes, check if more data needs to be loaded
  useEffect(() => {
    // Only check when data is initialized and has row data
    if (rows.length > 0 && initialized && hasMore) {
      // Check if more data needs to be loaded when row data updates
      window.requestAnimationFrame(() => {
        setTimeout(checkIfNeedMoreData, 300);
      });
    }

    // Ensure totalCount is at least consistent with current row count
    if (rows.length > totalCount) {
      console.log("Rows count exceeds totalCount, updating totalCount", {
        rows: rows.length,
        totalCount,
      });
      setTotalCount(rows.length);
    }

    // Check if all data is loaded
    if (rows.length > 0 && totalCount > 0 && rows.length >= totalCount) {
      if (hasMore) {
        console.log("All data loaded, setting hasMore to false");
        setHasMore(false);
      }
    }
  }, [rows, initialized, hasMore, checkIfNeedMoreData, totalCount]);

  // Add effect to monitor tableId changes and initialization completion
  useEffect(() => {
    if (tableId && initialized) {
      // Only attempt to load when there is more data
      console.log(
        "Table data initialized, checking if more data needs to be loaded",
      );
      // Only when there is more data, attempt to load
      if (hasMore) {
        setTimeout(checkIfNeedMoreData, 500);
      }
    }
  }, [tableId, initialized, checkIfNeedMoreData, hasMore]);

  // Force refresh current table data after cell update
  const updateCellMutation = api.table.updateCell.useMutation({
    onSuccess: () => {
      // cell 更新后强制刷新当前表数据
      void utils.table.getById.invalidate({ id: tableId });
    },
    onError: (error) => {
      toast({
        title: "Error updating cell",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Modify addRowMutation callback handling to avoid duplicate mock data generation
  const addRowMutation = api.table.addRow.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Row added successfully",
        duration: 2000,
        variant: "success",
      });

      // Only handle row ID update, preserve frontend generated mock data content
      if (data?.record) {
        // Find last temporary row data
        const tempRowIndex = rows.findIndex((row) =>
          row.id.startsWith("temp-"),
        );

        if (tempRowIndex !== -1) {
          // Get temporary row data
          const tempRow = rows[tempRowIndex];

          // Ensure temporary row exists
          if (tempRow) {
            // Create new row object, preserve all temporary row data, only change ID
            const newRow = {
              ...tempRow,
              id: data.record.id,
            };

            // Update row data, replace temporary row
            const updatedRows = [...rows];
            updatedRows[tempRowIndex] = newRow;

            // Update state and cache
            setRowsAndCache(updatedRows);

            console.log("Row added successfully, updated row ID", {
              fromId: tempRow.id,
              toId: data.record.id,
              totalRows: updatedRows.length,
              totalCount,
            });
          }
        } else {
          // If temporary row not found (this should rarely happen), return to original logic
          utils.table.getById
            .fetch({
              id: tableId,
              skip: 0, // Always start from first row as we need to find the newly added row
              take: totalCount, // Get all rows to ensure including new row
              loadAll: true, // Load all data to avoid pagination issues
            })
            .then((newData) => {
              if (newData?.rows?.length) {
                // Find newly added row
                const newRow = newData.rows.find(
                  (r) => r.id === data.record.id,
                );

                if (newRow) {
                  // Update row data, preserve other temporary rows
                  const updatedRows = [...rows];
                  const nonTempRows = updatedRows.filter(
                    (row) =>
                      !row.id.startsWith("temp-") || row.id === data.record.id,
                  );
                  nonTempRows.push(newRow);
                  setRows(nonTempRows);

                  // Update cache
                  tableCache.current[tableId] = {
                    columns: columns,
                    rows: nonTempRows,
                  };

                  // Update pagination info
                  if (newData.pagination) {
                    setTotalCount(newData.pagination.totalCount);
                  }
                }
              }
            })
            .catch((error) => {
              console.error(
                "Failed to get new row data",
                error instanceof Error ? error.message : String(error),
              );
            });
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Error adding row",
        description: error.message,
        variant: "destructive",
      });

      // Remove temporary rows
      const updatedRows = rows.filter((row) => !row.id.startsWith("temp-"));
      setRowsAndCache(updatedRows);

      // Restore total count counter
      if (totalCount > updatedRows.length) {
        setTotalCount(updatedRows.length);
      }
    },
  });

  const addColumnMutation = api.table.addColumn.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Column added successfully",
        duration: 2000,
        variant: "success",
      });

      if (data?.field) {
        // Create real new column object, replace temporary column
        const newColumn: Column = {
          id: data.field.id,
          name: data.field.name,
          type: (data.field.type as "text" | "number") || "text",
          width: 200,
        };

        // Find and replace temporary column
        const updatedColumns = columns.map((col) =>
          col.id.startsWith("temp-") ? newColumn : col,
        );

        // Ensure not to miss new column
        if (!updatedColumns.some((col) => col.id === newColumn.id)) {
          updatedColumns.push(newColumn);
        }

        // Use correct column ID to update all rows
        const updatedRows = rows.map((row) => {
          const newRow = { ...row };
          // Find temporary column value
          const tempColId = Object.keys(row).find((key) =>
            key.startsWith("temp-"),
          );
          if (tempColId && newColumn.id) {
            // Ensure temporary value exists, not undefined
            const tempValue = row[tempColId];
            newRow[newColumn.id] = tempValue !== undefined ? tempValue : null;
            delete newRow[tempColId]; // Delete temporary column value
          }
          return newRow;
        });

        // Update state and cache
        setColumns(updatedColumns);
        setRows(updatedRows);
        tableCache.current[tableId] = {
          columns: updatedColumns,
          rows: updatedRows,
        };

        console.log("Column added successfully, direct state update", {
          newColumn,
        });
      } else {
        // If no field data is received, need to re-fetch
        utils.table.getById
          .fetch({
            id: tableId,
            skip: 0,
            take: rows.length,
            loadAll: false,
          })
          .then((newData) => {
            if (newData?.columns?.length) {
              // Update column and row data, keep current scroll position
              setColumns(newData.columns as Column[]);

              // Filter out temporary rows
              const updatedRows = newData.rows.filter(
                (r) => !r.id.startsWith("temp-"),
              );
              setRows(updatedRows);

              // Update cache
              tableCache.current[tableId] = {
                columns: newData.columns as Column[],
                rows: updatedRows,
              };

              console.log("Column added successfully, updated display data", {
                newColumns: newData.columns,
              });
            }
          })
          .catch((error) => {
            console.error(
              "Failed to get new column data",
              error instanceof Error ? error.message : String(error),
            );
          });
      }
    },
    onError: (error) => {
      toast({
        title: "Error adding column",
        description: error.message,
        variant: "destructive",
      });

      // Remove temporary columns
      const updatedColumns = columns.filter(
        (col) => !col.id.startsWith("temp-"),
      );
      setColumnsAndCache(updatedColumns);

      // Remove temporary column data from rows
      const updatedRows = rows.map((row) => {
        const newRow = { ...row };
        Object.keys(newRow).forEach((key) => {
          if (key.startsWith("temp-")) {
            delete newRow[key];
          }
        });
        return newRow;
      });
      setRowsAndCache(updatedRows);
    },
  });

  useEffect(() => {
    if (!isLoadingSession && !session?.user) {
      router.replace("/");
    }
  }, [session, isLoadingSession, router]);

  // Active checkIfNeedMoreData, rows/columns/totalCount/initialized/hasMore changes
  useEffect(() => {
    if (!(initialized && hasMore)) return;
    window.requestAnimationFrame(() => {
      setTimeout(() => {
        const tableContainer = document.querySelector(".table-container");
        if (tableContainer) {
          const { scrollHeight, clientHeight } = tableContainer;
          if (scrollHeight <= clientHeight + 10) {
            // Content not enough to fill screen, auto load
            void loadMoreData();
          } else {
            checkIfNeedMoreData();
          }
        }
      }, 100);
    });
  }, [
    rows,
    columns,
    totalCount,
    initialized,
    hasMore,
    loadMoreData,
    checkIfNeedMoreData,
  ]);

  // Timer backup check, check every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasMore && !isLoadingMore && !isLoadingLockRef.current) {
        checkIfNeedMoreData();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [hasMore, isLoadingMore, checkIfNeedMoreData]);

  const add100kRowsMutation = api.table.add100kRows.useMutation({
    onSuccess: () => {
      toast({
        title: "Added 100k rows successfully",
        duration: 2000,
        variant: "success",
      });
      // Refresh table data
      void utils.table.getById.invalidate({ id: tableId });
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

  // Modify handleAddRow call to call backend API
  const handleAddRow = () => {
    // Increment temp ID counter to ensure uniqueness
    tempIdCounterRef.current += 1;

    // Generate a temporary ID - add counter to timestamp to ensure uniqueness even when clicked rapidly
    const temporaryId = `temp-${Date.now()}-${tempIdCounterRef.current}`;

    // Use faker directly to generate new row with mock data
    const newRow: TableRow = {
      id: temporaryId,
    };

    // Add mock data to each column instead of "Loading..."
    columns.forEach((column) => {
      if (column.id === "name" || column.name.toLowerCase() === "name") {
        newRow[column.id] = faker.person.fullName();
      } else if (
        column.id === "email" ||
        column.name.toLowerCase() === "email"
      ) {
        newRow[column.id] = faker.internet.email();
      } else if (
        column.id === "phone" ||
        column.name.toLowerCase() === "phone"
      ) {
        newRow[column.id] = faker.phone.number();
      } else if (
        column.id === "address" ||
        column.name.toLowerCase() === "address"
      ) {
        newRow[column.id] = faker.location.streetAddress();
      } else if (column.type === "number") {
        newRow[column.id] = faker.number.int(100);
      } else {
        newRow[column.id] = faker.lorem.word();
      }
    });

    // Immediately update state and cache, display mock data
    const updatedRows = [...rows, newRow];
    setRowsAndCache(updatedRows);

    // Update total count counter
    setTotalCount((prevCount) => prevCount + 1);

    // Call backend API to add row
    addRowMutation.mutate({
      tableId: tableId,
    });
  };

  // Modify handleAddColumn call to call backend API
  const handleAddColumn = () => {
    // Pop up dialog for user to input column name
    const columnName = prompt("Enter column name:");
    if (!columnName) return;

    // Increment temp ID counter to ensure uniqueness
    tempIdCounterRef.current += 1;

    // Generate temporary ID
    const temporaryId = `temp-${Date.now()}-${tempIdCounterRef.current}`;

    // Create new column
    const newColumn: Column = {
      id: temporaryId,
      name: columnName,
      type: "text",
      width: 200,
    };

    // Update column list
    const newColumns = [...columns, newColumn];
    setColumnsAndCache(newColumns);

    // Add mock data to all rows in new column
    const updatedRows = rows.map((row) => ({
      ...row,
      [temporaryId]: faker.lorem.word(),
    }));

    // Update row data and cache
    setRowsAndCache(updatedRows);

    // Call backend API to add column
    addColumnMutation.mutate({
      tableId: tableId,
      name: columnName,
      type: "text", // Default text type
    });
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
          <div
            className="table-container h-full overflow-auto overscroll-none"
            style={{
              maxHeight: "calc(100vh - 160px)",
              overscrollBehavior: "contain", // Prevent scroll chaining
              WebkitOverflowScrolling: "touch", // Improve scroll on iOS
            }}
            data-table-id={tableId} // Add data attribute for debugging and tracking table ID changes
          >
            <TableView
              columns={columns}
              rows={rows}
              onAddRow={handleAddRow}
              onAddColumn={handleAddColumn}
              onUpdateCell={handleUpdateCell}
              showAddRowButton={!hasMore}
              onAdd100kRows={handleAdd100kRows}
            />
            {/* Hidden reference point, used to detect scroll position */}
            <div ref={tableBottomRef} className="h-px w-full" />
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
  );
}
