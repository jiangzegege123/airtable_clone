import { Menu } from "lucide-react";
import { Button } from "~/components/ui/button";

export default function DashboardHeader({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>
    </header>
  );
}
