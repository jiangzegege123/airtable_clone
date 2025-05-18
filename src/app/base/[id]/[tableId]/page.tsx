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

  // 添加分页状态
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

  // 默认字段
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

  // 用于加载更多数据的查询
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

  // 添加强制检查是否需要加载更多数据的函数
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

    // 使用更可靠的选择器, ".table-container" 类可能更一致地存在
    const tableContainer = document.querySelector(".table-container");

    if (!tableContainer || !tableBottomRef.current) {
      console.log("Check conditions not met", {
        hasContainer: !!tableContainer,
        hasBottomRef: !!tableBottomRef.current,
      });
      return false;
    }

    // 获取容器尺寸信息
    const { scrollTop, clientHeight, scrollHeight } = tableContainer;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;

    console.log("Container dimensions", {
      scrollTop,
      clientHeight,
      scrollHeight,
      scrollBottom,
      threshold: Math.min(300, clientHeight * 0.3), // 动态阈值，较小的屏幕用较小的阈值
    });

    // 计算一个基于容器高度的动态阈值，较小的容器使用较小的阈值，但不超过300px
    const threshold = Math.min(300, clientHeight * 0.3);

    // 如果内容不足一屏或接近底部，加载更多
    if (scrollBottom < threshold) {
      console.log("Content not filling the view, loading more automatically");
      void loadMoreData();
      return true;
    }

    return false;
  }, [hasMore, isLoadingMore, loadMoreData, tableId]);

  // 设置无限滚动的监听
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

      // 获取滚动容器
      const container = e.target as HTMLElement;
      if (!container) return;

      // 计算是否需要加载更多
      const { scrollTop, clientHeight, scrollHeight } = container;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;

      // 使用动态阈值，但不小于50px
      const threshold = Math.max(50, clientHeight * 0.2);

      // 当距离底部还有阈值距离时加载更多
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

  // 当表格数据加载成功时的处理
  useEffect(() => {
    if (tableData && !initialized) {
      console.log("Table data received from server", tableData);

      // 设置分页信息
      if (tableData.pagination) {
        setHasMore(tableData.pagination.hasMore);
        setTotalCount(tableData.pagination.totalCount);
        setSkip(10); // 初始加载10条，下次从第10条开始
      }

      // 设置表格数据
      if (tableData.columns?.length) {
        setColumns(tableData.columns as Column[]);
        setRows(tableData.rows);
        // 写入缓存
        tableCache.current[tableId] = {
          columns: tableData.columns as Column[],
          rows: tableData.rows,
        };
        setInitialized(true);
      } else {
        // 没有数据时用默认值
        setColumns(defaultColumns);
        setRows(generateFakeRows(10));
        // 写入缓存
        tableCache.current[tableId] = {
          columns: defaultColumns,
          rows: generateFakeRows(10),
        };
        setInitialized(true);
      }

      // 标记数据刚初始化，用于触发首次滚动检查
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          // 嵌套requestAnimationFrame确保在数据渲染后检查
          checkIfNeedMoreData();
        });
      });
    }
  }, [tableData, initialized, tableId, defaultColumns, checkIfNeedMoreData]);

  // 特别为页面首次加载添加一个监听器，确保所有DOM元素都加载完
  useEffect(() => {
    if (tableId && initialized) {
      // 使用MutationObserver监听DOM变化
      const observer = new MutationObserver((mutations) => {
        // 当DOM变化后检查是否需要加载更多
        window.requestAnimationFrame(() => {
          checkIfNeedMoreData();
        });

        // 只运行一次，然后解除监听
        observer.disconnect();
      });

      // 监听表格容器的变化
      const container = document.querySelector(".table-container");
      if (container) {
        observer.observe(container, {
          childList: true,
          subtree: true,
        });

        // 确保不超过5秒
        setTimeout(() => observer.disconnect(), 5000);
      }

      return () => observer.disconnect();
    }
  }, [tableId, initialized, checkIfNeedMoreData]);

  // 监听 tableId 变化
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
        // 从缓存加载数据
        setColumns(cached.columns);
        setRows(cached.rows);
        setInitialized(true);

        // 设置hasMore为false，如果我们已经加载了所有数据
        // 这样可以防止切换回已加载完全的表格时触发新的加载
        if (cached.rows.length === totalCount) {
          setHasMore(false);
        }
      } else {
        // 没有缓存则重置状态，等待数据加载
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

  // 首次加载完成后检查是否需要加载更多数据的专用useEffect
  useEffect(() => {
    // 仅当表格数据首次加载完成后执行
    if (initialized && rows.length > 0 && hasMore) {
      console.log("首次数据加载完成，检查是否需要加载更多");
      // 使用requestAnimationFrame确保DOM已更新
      window.requestAnimationFrame(() => {
        setTimeout(() => {
          // 强制检查滚动位置
          const tableContainer = document.querySelector(".table-container");
          if (tableContainer) {
            const { scrollHeight, clientHeight } =
              tableContainer as HTMLElement;

            // 如果内容不足以填满容器，立即加载更多
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

  // 注册滚动事件监听
  useEffect(() => {
    // Skip registering if we're in the middle of changing tables
    if (tableId !== currentTableIdRef.current || isLoadingLockRef.current) {
      return;
    }

    console.log("Registering scroll event");

    // 使用requestAnimationFrame确保DOM已渲染
    const registerScrollEvent = () => {
      // 查找表格容器
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

        // 添加一个滚动位置检查的定时器，防止某些情况下滚动事件不触发
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
        // 如果没找到容器，可能DOM还没渲染完成，稍后再尝试
        const timeoutId = setTimeout(registerScrollEvent, 200);
        return () => clearTimeout(timeoutId);
      }
    };

    // 启动注册过程
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

  // 监听行数据变化，检查是否需要加载更多
  useEffect(() => {
    // 只在数据已初始化且有行数据时检查
    if (rows.length > 0 && initialized && hasMore) {
      // 当行数据更新后，检查是否需要加载更多
      window.requestAnimationFrame(() => {
        setTimeout(checkIfNeedMoreData, 300);
      });
    }

    // 确保totalCount至少与当前行数一致
    if (rows.length > totalCount) {
      console.log("Rows count exceeds totalCount, updating totalCount", {
        rows: rows.length,
        totalCount,
      });
      setTotalCount(rows.length);
    }

    // 检查是否已加载所有数据
    if (rows.length > 0 && totalCount > 0 && rows.length >= totalCount) {
      if (hasMore) {
        console.log("All data loaded, setting hasMore to false");
        setHasMore(false);
      }
    }
  }, [rows, initialized, hasMore, checkIfNeedMoreData, totalCount]);

  // 添加一个监听 tableId 变化以及初始化完成的效果
  useEffect(() => {
    if (tableId && initialized) {
      // 确保在表格数据加载并初始化后触发检查
      console.log(
        "Table data initialized, checking if more data needs to be loaded",
      );
      // 仅当还有更多数据时才尝试加载
      if (hasMore) {
        setTimeout(checkIfNeedMoreData, 500);
      }
    }
  }, [tableId, initialized, checkIfNeedMoreData, hasMore]);

  // Set up cell update mutation
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

  // 修改 addRowMutation 回调处理，避免重复生成假数据
  const addRowMutation = api.table.addRow.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Row added successfully",
        duration: 2000,
        variant: "success",
      });

      // 只处理行ID的更新，保留前端已经生成的假数据内容
      if (data?.record) {
        // 查找最后一行临时数据
        const tempRowIndex = rows.findIndex((row) =>
          row.id.startsWith("temp-"),
        );

        if (tempRowIndex !== -1) {
          // 获取临时行数据
          const tempRow = rows[tempRowIndex];

          // 确保临时行存在
          if (tempRow) {
            // 创建新行对象，保留临时行的所有数据，只更改ID
            const newRow = {
              ...tempRow,
              id: data.record.id,
            };

            // 更新行数据，替换临时行
            const updatedRows = [...rows];
            updatedRows[tempRowIndex] = newRow;

            // 更新状态和缓存
            setRowsAndCache(updatedRows);

            console.log("Row added successfully, updated row ID", {
              fromId: tempRow.id,
              toId: data.record.id,
              totalRows: updatedRows.length,
              totalCount,
            });
          }
        } else {
          // 如果找不到临时行（这种情况应该很少发生），则返回到原来的逻辑
          utils.table.getById
            .fetch({
              id: tableId,
              skip: 0, // 始终从第一行开始获取，因为我们需要找到刚添加的行
              take: totalCount, // 获取所有行，确保包含新行
              loadAll: true, // 加载全部数据，避免分页问题
            })
            .then((newData) => {
              if (newData?.rows?.length) {
                // 找到新添加的行
                const newRow = newData.rows.find(
                  (r) => r.id === data.record.id,
                );

                if (newRow) {
                  // 更新行数据，保留其他临时行
                  const updatedRows = [...rows];
                  const nonTempRows = updatedRows.filter(
                    (row) =>
                      !row.id.startsWith("temp-") || row.id === data.record.id,
                  );
                  nonTempRows.push(newRow);
                  setRows(nonTempRows);

                  // 更新缓存
                  tableCache.current[tableId] = {
                    columns: columns,
                    rows: nonTempRows,
                  };

                  // 更新分页信息
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

      // 移除临时行
      const updatedRows = rows.filter((row) => !row.id.startsWith("temp-"));
      setRowsAndCache(updatedRows);

      // 恢复总数计数器
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
        // 创建真实的新列对象，替代临时列
        const newColumn: Column = {
          id: data.field.id,
          name: data.field.name,
          type: (data.field.type as "text" | "number") || "text",
          width: 200,
        };

        // 找到并替换临时列
        const updatedColumns = columns.map((col) =>
          col.id.startsWith("temp-") ? newColumn : col,
        );

        // 确保不会漏掉新列
        if (!updatedColumns.some((col) => col.id === newColumn.id)) {
          updatedColumns.push(newColumn);
        }

        // 用正确的列ID更新所有行
        const updatedRows = rows.map((row) => {
          const newRow = { ...row };
          // 找到临时列的值
          const tempColId = Object.keys(row).find((key) =>
            key.startsWith("temp-"),
          );
          if (tempColId && newColumn.id) {
            // 确保临时值存在，不为undefined
            const tempValue = row[tempColId];
            newRow[newColumn.id] = tempValue !== undefined ? tempValue : null;
            delete newRow[tempColId]; // 删除临时列的值
          }
          return newRow;
        });

        // 更新状态和缓存
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
        // 如果没有收到字段数据，则需要重新获取
        utils.table.getById
          .fetch({
            id: tableId,
            skip: 0,
            take: rows.length,
            loadAll: false,
          })
          .then((newData) => {
            if (newData?.columns?.length) {
              // 更新列和行数据，保持当前滚动位置
              setColumns(newData.columns as Column[]);

              // 过滤掉临时行
              const updatedRows = newData.rows.filter(
                (r) => !r.id.startsWith("temp-"),
              );
              setRows(updatedRows);

              // 更新缓存
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

      // 移除临时列
      const updatedColumns = columns.filter(
        (col) => !col.id.startsWith("temp-"),
      );
      setColumnsAndCache(updatedColumns);

      // 从行中移除临时列数据
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

  // 主动 checkIfNeedMoreData，rows/columns/totalCount/initialized/hasMore 变化时
  useEffect(() => {
    if (!(initialized && hasMore)) return;
    window.requestAnimationFrame(() => {
      setTimeout(() => {
        const tableContainer = document.querySelector(".table-container");
        if (tableContainer) {
          const { scrollHeight, clientHeight } = tableContainer;
          if (scrollHeight <= clientHeight + 10) {
            // 内容不足一屏，自动加载
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

  // 定时器 backup 检查，每 500ms 检查一次
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasMore && !isLoadingMore && !isLoadingLockRef.current) {
        checkIfNeedMoreData();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [hasMore, isLoadingMore, checkIfNeedMoreData]);

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

  // 修改 handleAddRow 调用后端 API
  const handleAddRow = () => {
    // Increment temp ID counter to ensure uniqueness
    tempIdCounterRef.current += 1;

    // 生成一个临时ID - add counter to timestamp to ensure uniqueness even when clicked rapidly
    const temporaryId = `temp-${Date.now()}-${tempIdCounterRef.current}`;

    // 使用faker直接生成带有假数据的新行
    const newRow: TableRow = {
      id: temporaryId,
    };

    // 为每列添加假数据而不是"Loading..."
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

    // 立即更新状态和缓存，显示假数据
    const updatedRows = [...rows, newRow];
    setRowsAndCache(updatedRows);

    // 更新总数计数器
    setTotalCount((prevCount) => prevCount + 1);

    // 同时调用后端 API 添加行
    addRowMutation.mutate({
      tableId: tableId,
    });
  };

  // 修改 handleAddColumn 调用后端 API
  const handleAddColumn = () => {
    // 弹出对话框让用户输入列名
    const columnName = prompt("Enter column name:");
    if (!columnName) return;

    // Increment temp ID counter to ensure uniqueness
    tempIdCounterRef.current += 1;

    // 生成临时ID
    const temporaryId = `temp-${Date.now()}-${tempIdCounterRef.current}`;

    // 创建新列
    const newColumn: Column = {
      id: temporaryId,
      name: columnName,
      type: "text",
      width: 200,
    };

    // 更新列列表
    const newColumns = [...columns, newColumn];
    setColumnsAndCache(newColumns);

    // 为所有行在新列中添加假数据
    const updatedRows = rows.map((row) => ({
      ...row,
      [temporaryId]: faker.lorem.word(),
    }));

    // 更新行数据并缓存
    setRowsAndCache(updatedRows);

    // 同时调用后端 API 添加列
    addColumnMutation.mutate({
      tableId: tableId,
      name: columnName,
      type: "text", // 默认文本类型
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
            data-table-id={tableId} // 添加数据属性以便调试和追踪表格ID变化
          >
            <TableView
              columns={columns}
              rows={rows}
              onAddRow={handleAddRow}
              onAddColumn={handleAddColumn}
              onUpdateCell={handleUpdateCell}
              showAddRowButton={!hasMore}
            />
            {/* 加载更多的提示和引用点 */}
            <div ref={tableBottomRef} className="py-2 text-center">
              {isLoadingMore ? (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
                  <span className="ml-2 text-sm text-gray-500">
                    Loading more data...
                  </span>
                </div>
              ) : hasMore ? (
                <span className="text-sm text-gray-400">
                  Scroll to load more ({rows.length} of {totalCount})
                </span>
              ) : rows.length > 0 ? (
                <div className="py-4">
                  <span className="text-sm text-gray-400">
                    All {totalCount} records loaded
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-400">No data available</span>
              )}
            </div>
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
