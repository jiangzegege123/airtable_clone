import { Home, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Leftbar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-gray-200 bg-white">
      <nav className="flex h-full flex-col px-3 py-4">
        <div className="space-y-1">
          <Link
            href="/dashboard"
            className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium ${
              pathname === "/dashboard"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Home className="mr-3 h-5 w-5" />
            Dashboard
          </Link>
        </div>
        <div className="mt-auto space-y-1">
          <Link
            href="/settings"
            className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium ${
              pathname === "/settings"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Settings className="mr-3 h-5 w-5" />
            Settings
          </Link>
        </div>
      </nav>
    </aside>
  );
}
