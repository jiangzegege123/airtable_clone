import { Database, X } from "lucide-react";
import Link from "next/link";
import type { Base } from "@prisma/client";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useState } from "react";

export function BaseCard({ base }: { base: Base }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const utils = api.useUtils();

  const { mutate: deleteBase } = api.base.delete.useMutation({
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: () => {
      void utils.base.list.invalidate();
    },
    onError: (error) => {
      setIsDeleting(false);
      console.error("Failed to delete base:", error);
      // 这里可以添加一个 toast 提示
    },
  });

  return (
    <div className="group relative rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => void deleteBase({ id: base.id })}
        disabled={isDeleting}
      >
        <X className="h-4 w-4 text-gray-500 hover:text-red-500" />
      </Button>

      <Link href={`/base/${base.id}`} className="block">
        <div className="flex items-center">
          <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-md bg-purple-600 text-white">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-medium">
              {base.name || "Untitled Base"}
            </h4>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(base.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
