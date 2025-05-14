// src/utils/api.ts
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "~/server/api/root";

// Create frontend tRPC client instance
export const api = createTRPCReact<AppRouter>();
