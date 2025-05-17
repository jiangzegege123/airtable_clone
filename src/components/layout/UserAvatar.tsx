"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

interface UserAvatarProps {
  user: Session["user"];
}

export function UserAvatar({ user }: UserAvatarProps) {
  // Get first letter of name or email
  const initial = user.name?.[0] ?? user.email?.[0] ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 font-medium text-[#63498D] transition-colors hover:bg-purple-200">
          {initial.toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => void signOut()}
          className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
