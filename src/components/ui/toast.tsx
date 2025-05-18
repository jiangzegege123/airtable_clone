"use client";

import * as React from "react";
import { useToast } from "./use-toast";
import { cn } from "~/lib/utils";
import { X } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex w-full max-w-md flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto w-full translate-x-0 transform rounded-lg shadow-lg transition-all duration-300 ease-in-out",
            "overflow-hidden border border-gray-200",
            {
              "bg-white": toast.variant === "default",
              "border-red-200 bg-red-50": toast.variant === "destructive",
              "border-green-200 bg-green-50": toast.variant === "success",
            },
          )}
        >
          <div className="relative">
            <div className="p-4 pr-8">
              <div className="flex items-start">
                <div className="flex-1">
                  <p
                    className={cn("text-sm font-medium", {
                      "text-gray-900": toast.variant === "default",
                      "text-red-800": toast.variant === "destructive",
                      "text-green-800": toast.variant === "success",
                    })}
                  >
                    {toast.title}
                  </p>
                  {toast.description && (
                    <p
                      className={cn("mt-1 text-sm", {
                        "text-gray-500": toast.variant === "default",
                        "text-red-700": toast.variant === "destructive",
                        "text-green-700": toast.variant === "success",
                      })}
                    >
                      {toast.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className={cn(
                "absolute top-2 right-2 rounded-full p-1 hover:bg-gray-100 focus:ring-2 focus:ring-offset-2 focus:outline-none",
                {
                  "focus:ring-gray-500": toast.variant === "default",
                  "hover:bg-red-100 focus:ring-red-500":
                    toast.variant === "destructive",
                  "hover:bg-green-100 focus:ring-green-500":
                    toast.variant === "success",
                },
              )}
            >
              <X
                size={14}
                className={cn({
                  "text-gray-400": toast.variant === "default",
                  "text-red-400": toast.variant === "destructive",
                  "text-green-400": toast.variant === "success",
                })}
              />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
