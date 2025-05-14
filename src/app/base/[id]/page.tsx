"use client";

import { redirect, useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Plus, Table as TableIcon, X, Loader2 } from "lucide-react";
import { Input } from "~/components/ui/input";
import Link from "next/link";

export default function BasePage() {
  const params = useParams();
  const baseId = params.id as string;

  // Fetch session and base data
  const { data: session } = api.auth.getSession.useQuery();
  const {
    data: tables = [],
    isLoading,
    error,
  } = api.table.list.useQuery(
    { baseId },
    {
      enabled: !!session?.user,
      retry: 1,
      onError: (error) => {
        console.error("Failed to fetch tables:", error);
      },
    },
  );

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [tableName, setTableName] = useState("");

  const utils = api.useUtils();
  const { mutate: createTable, isLoading: isCreating } =
    api.table.create.useMutation({
      onSuccess: () => {
        setTableName("");
        setShowCreateForm(false);
        void utils.table.list.invalidate({ baseId });
      },
      onError: (error) => {
        console.error("Failed to create table:", error);
      },
    });

  const { mutate: deleteTable, isLoading: isDeleting } =
    api.table.delete.useMutation({
      onSuccess: () => {
        void utils.table.list.invalidate({ baseId });
      },
      onError: (error) => {
        console.error("Failed to delete table:", error);
      },
    });

  useEffect(() => {
    if (!session?.user) {
      redirect("/");
    }
  }, [session]);

  if (!session?.user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">Loading tables...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <h3 className="text-lg font-medium text-red-800">
            Error loading tables
          </h3>
          <p className="mt-1 text-sm text-red-600">{error.message}</p>
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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              ← Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Tables</h1>
        </div>
      </header>

      <div className="flex-1 p-4 lg:p-8">
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Your Tables</h3>
            {!showCreateForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Table
              </Button>
            )}
          </div>

          {showCreateForm && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter table name"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tableName.trim() !== "") {
                    void createTable({ name: tableName, baseId });
                  } else if (e.key === "Escape") {
                    setShowCreateForm(false);
                  }
                }}
                autoFocus
                disabled={isCreating}
              />
              <Button
                onClick={() => {
                  void createTable({ name: tableName, baseId });
                }}
                disabled={tableName.trim() === "" || isCreating}
              >
                {isCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create Table
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCreateForm(false)}
                disabled={isCreating}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {tables.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((table) => (
                <div
                  key={table.id}
                  className="group relative rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => {
                      void deleteTable({ id: table.id, baseId });
                    }}
                    disabled={isDeleting}
                  >
                    <X className="h-4 w-4 text-gray-500 hover:text-red-500" />
                  </Button>

                  <div className="flex items-center">
                    <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-md bg-purple-600 text-white">
                      <TableIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-medium">
                        {table.name || "Untitled Table"}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Last updated:{" "}
                        {new Date(table.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 py-6 text-center lg:py-8">
              <TableIcon className="mx-auto mb-3 h-10 w-10 text-gray-400 lg:h-12 lg:w-12" />
              <h3 className="mb-1 text-base font-medium text-gray-700 lg:text-lg">
                No tables yet
              </h3>
              <p className="text-sm text-gray-500 lg:text-base">
                Create your first table using the button above
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
