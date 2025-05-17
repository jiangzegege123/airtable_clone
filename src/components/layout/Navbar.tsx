import { Button } from "~/components/ui/button";
import Link from "next/link";
import { CloudIcon } from "~/components/icons/CloudIcon";
import { api } from "~/trpc/react";
import { UserAvatar } from "./UserAvatar";

interface NavbarProps {
  showBaseInfo?: boolean;
  baseId?: string;
}

export function Navbar({ showBaseInfo, baseId }: NavbarProps) {
  // Fetch base name if baseId is provided
  const { data: baseData } = api.base.getById.useQuery(
    { id: baseId! },
    {
      enabled: !!baseId && !!showBaseInfo,
      staleTime: Infinity,
    },
  );

  // Fetch session to get user data
  const { data: session } = api.auth.getSession.useQuery();

  const baseName = baseData?.name ?? "Untitled Base";

  return (
    <header className="flex h-14 items-center justify-between bg-[#63498D] px-4 text-white lg:px-6">
      <div className="flex items-center gap-4">
        {showBaseInfo && (
          <Link
            href="/dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-md hover:bg-[#7456A5]"
          >
            <CloudIcon className="h-7.5 w-7.5" />
          </Link>
        )}
        <h1 className="text-xl font-semibold">
          {showBaseInfo ? baseName : "Airtable Clone"}
        </h1>
      </div>

      {/* User avatar */}
      {session?.user && (
        <div>
          <UserAvatar user={session.user} />
        </div>
      )}
    </header>
  );
}
