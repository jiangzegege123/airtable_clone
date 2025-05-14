"use client";

import { redirect } from "next/navigation";
import { Database, Menu } from "lucide-react";
import Leftbar from "../_components/dashboard/Leftbar";
import { BaseCard } from "../_components/dashboard/BaseCard";
import type { Base } from "@prisma/client";
import CreateBaseWrapper from "../_components/dashboard/CreateBaseWrapper";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";
import { UserButton } from "../_components/auth/UserButton";
import { Button } from "~/components/ui/button";

export default function DashboardPage() {
  const { data: session } = api.auth.getSession.useQuery();
  const { data: bases = [] } = api.base.list.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!session?.user) {
      redirect("/");
    }
  }, [session]);

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans">
      <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Airtable Clone</h1>
        </div>
        <UserButton user={session.user} />
      </header>

      <div className="flex flex-1">
        {/* Mobile sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white transition-transform duration-200 ease-in-out lg:hidden ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-full pt-16">
            <Leftbar />
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Leftbar />
        </div>

        {/* Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm transition-opacity lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div className="relative flex-1 overflow-y-auto px-4 pt-4 pb-6 lg:p-8">
          <div className="mb-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-500">Your Bases</h3>

            {bases.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {bases.map((base: Base) => (
                  <BaseCard base={base} key={base.id} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 py-6 text-center lg:py-8">
                <Database className="mx-auto mb-3 h-10 w-10 text-gray-400 lg:h-12 lg:w-12" />
                <h3 className="mb-1 text-base font-medium text-gray-700 lg:text-lg">
                  No bases yet
                </h3>
                <p className="text-sm text-gray-500 lg:text-base">
                  Create your first base using the Quick Actions below
                </p>
              </div>
            )}
          </div>

          <div className="mb-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-500">Quick Actions</h3>
            <CreateBaseWrapper />
          </div>
        </div>
      </div>
    </div>
  );
}
