"use client";

import type { Session } from "next-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { signOut } from "next-auth/react";

interface UserButtonProps {
  user: Session["user"];
}

export function UserButton({ user }: UserButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <img
            src={user.image ?? `https://avatar.vercel.sh/${user.email}`}
            alt={user.name ?? "User avatar"}
            className="h-8 w-8 rounded-full"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="text-sm font-medium"
          onSelect={(e) => {
            e.preventDefault();
          }}
        >
          {user.name ?? user.email}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-sm text-red-600"
          onSelect={() => void signOut()}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
