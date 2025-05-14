// src/app/_components/dashboard/CreateBaseWrapper.tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import CreateBase component (client-side rendering)
const CreateBase = dynamic(() => import("./CreateBase"), { ssr: false });

export default function CreateBaseWrapper() {
  const [showForm, setShowForm] = useState(false);

  const handleCreateSuccess = () => {
    setShowForm(false);
  };

  return (
    <div>
      {!showForm ? (
        <button
          className="flex items-center rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
          onClick={() => setShowForm(true)}
        >
          <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-600">
            <Plus className="h-5 w-5" />
          </div>
          <span className="font-medium">Create New Base</span>
        </button>
      ) : (
        <CreateBase onSuccess={handleCreateSuccess} />
      )}
    </div>
  );
}
