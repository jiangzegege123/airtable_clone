"use client";

import * as React from "react";
import { useToast } from "./use-toast";
import { cn } from "~/lib/utils";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "ring-opacity-5 pointer-events-auto flex w-full max-w-md rounded-lg bg-white shadow-lg ring-1 ring-black",
            {
              "bg-red-50": toast.variant === "destructive",
            },
          )}
        >
          <div className="w-0 flex-1 p-4">
            <div className="flex items-start">
              <div className="flex-1">
                <p
                  className={cn("text-sm font-medium", {
                    "text-red-800": toast.variant === "destructive",
                    "text-gray-900": toast.variant === "default",
                  })}
                >
                  {toast.title}
                </p>
                {toast.description && (
                  <p
                    className={cn("mt-1 text-sm", {
                      "text-red-700": toast.variant === "destructive",
                      "text-gray-500": toast.variant === "default",
                    })}
                  >
                    {toast.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
