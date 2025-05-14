"use client";
import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface CreateBaseProps {
  onSuccess?: () => void;
}

export default function CreateBase({ onSuccess }: CreateBaseProps) {
  const [baseName, setBaseName] = useState("");

  const utils = api.useUtils();
  const { mutate, error } = api.base.create.useMutation({
    onSuccess: () => {
      setBaseName("");
      void utils.base.list.invalidate();
      onSuccess?.();
    },
  });

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Enter base name"
        value={baseName}
        onChange={(e) => setBaseName(e.target.value)}
      />
      <Button
        onClick={() => {
          void mutate({ name: baseName });
        }}
        disabled={baseName.trim() === ""}
      >
        Create Base
      </Button>
      {error && <p className="text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
