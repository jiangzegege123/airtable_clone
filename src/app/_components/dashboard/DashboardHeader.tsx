import React from "react";
import { PanelLeft, HelpCircle, Search, Database, Menu } from "lucide-react";
import { UserDropdown } from "./UserDropdown";
import { Button } from "~/components/ui/button";
import type { Session } from "next-auth";
import { UserButton } from "../auth/UserButton";

interface DashboardHeaderProps {
  user: Session["user"];
  onMenuClick?: () => void;
}

export default function DashboardHeader({
  user,
  onMenuClick,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Airtable Clone</h1>
        </div>
        <UserButton user={user} />
      </div>
    </header>
  );
}
