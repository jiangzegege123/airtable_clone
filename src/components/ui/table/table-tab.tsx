import { X } from "lucide-react";
import { TabsTrigger } from "~/components/ui/tabs";

interface TableTabProps {
  id: string;
  name: string;
  onDelete: (id: string) => void;
}

export function TableTab({ id, name, onDelete }: TableTabProps) {
  return (
    <TabsTrigger
      value={id}
      className="relative flex h-full items-center gap-2 rounded-none border-x border-t border-transparent bg-transparent px-4 text-white hover:text-white/90 data-[state=active]:rounded-t-lg data-[state=active]:border-b-0 data-[state=active]:border-white data-[state=active]:bg-white data-[state=active]:pb-[1px] data-[state=active]:font-medium data-[state=active]:text-[#59427F]"
    >
      <span className="relative z-10">{name}</span>
      <button
        type="button"
        className="relative z-10 ml-1 rounded-full p-0.5 hover:bg-[#7456A5] data-[state=active]:hover:bg-gray-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
      >
        <X className="h-3 w-3 text-white data-[state=active]:text-gray-500" />
      </button>
    </TabsTrigger>
  );
}
