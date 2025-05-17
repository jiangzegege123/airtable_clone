"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "~/components/ui/use-toast";
import { Navbar } from "~/components/layout/Navbar";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { TableTab } from "~/components/ui/table/table-tab";

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

  useEffect(() => {
    if (!isLoadingSession && !session?.user) {
      router.replace("/");
    }
  }, [session, isLoadingSession, router]);

  // 自动跳转到第一个 table
  useEffect(() => {
    if (!isLoadingTables && tables.length > 0 && tables[0]?.id) {
      router.replace(`/base/${baseId}/${tables[0].id}`);
    }
  }, [isLoadingTables, tables, baseId, router]);

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

  const handleTableSelect = (tableId: string) => {
    router.push(`/base/${baseId}/${tableId}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar showBaseInfo baseId={baseId} />
      {/* Table Tabs */}
      <div className="bg-[#59427F]">
        <div className="flex h-12 items-center gap-2 px-4">
          <Tabs
            value={undefined}
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
      {/* Main Content Area */}
      <div className="flex flex-1 items-center justify-center">
        <span className="text-lg text-gray-400">
          Select a table to view its data.
        </span>
      </div>
    </div>
  );
}
