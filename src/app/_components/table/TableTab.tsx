import { ChevronDown, Trash } from "lucide-react";
import { TabsTrigger } from "~/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";

interface TableTabProps {
  id: string;
  name: string;
  onDelete: (id: string) => void;
}

export function TableTab({ id, name, onDelete }: TableTabProps) {
  return (
    <div className="group relative flex items-center">
      <TabsTrigger
        value={id}
        className="pr-8 data-[state=active]:border-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600"
      >
        {name}
      </TabsTrigger>

      <div className="absolute top-1/2 right-2 -translate-y-1/2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-gray-100"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-600 focus:bg-red-50 focus:text-red-600"
              onClick={() => onDelete(id)}
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete table
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
