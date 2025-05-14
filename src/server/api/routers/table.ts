import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { Table } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const tableRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        baseId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<Table> => {
      // Check if base exists and user has access
      const base = await ctx.db.base.findUnique({
        where: { id: input.baseId },
        select: { ownerId: true },
      });

      if (!base) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Base not found",
        });
      }

      if (base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to create tables in this base",
        });
      }

      return ctx.db.table.create({
        data: {
          name: input.name,
          baseId: input.baseId,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ baseId: z.string() }))
    .query(async ({ ctx, input }): Promise<Table[]> => {
      // Check if base exists and user has access
      const base = await ctx.db.base.findUnique({
        where: { id: input.baseId },
        select: { ownerId: true },
      });

      if (!base) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Base not found",
        });
      }

      if (base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view tables in this base",
        });
      }

      return ctx.db.table.findMany({
        where: { baseId: input.baseId },
        orderBy: { updatedAt: "desc" },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string(), baseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if table exists and user has access
      const table = await ctx.db.table.findUnique({
        where: { id: input.id },
        include: { base: { select: { ownerId: true } } },
      });

      if (!table) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Table not found",
        });
      }

      if (table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this table",
        });
      }

      await ctx.db.table.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
