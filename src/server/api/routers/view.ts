import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const viewRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        tableId: z.string(),
        filters: z.array(
          z.object({
            columnId: z.string(),
            operator: z.enum([
              "gt",
              "lt",
              "isEmpty",
              "isNotEmpty",
              "contains",
              "notContains",
              "equals",
            ]),
            value: z.union([z.string(), z.number()]).optional(),
          }),
        ),
        sorts: z.array(
          z.object({
            columnId: z.string(),
            direction: z.enum(["asc", "desc"]),
          }),
        ),
        hiddenColumns: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if table exists and user has access
      const table = await ctx.db.table.findUnique({
        where: { id: input.tableId },
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
          message: "You don't have permission to create views for this table",
        });
      }

      return ctx.db.view.create({
        data: {
          name: input.name,
          tableId: input.tableId,
          filters: input.filters,
          sorts: input.sorts,
          hiddenColumns: input.hiddenColumns,
          userId: ctx.session.user.id,
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.view.findMany({
        where: {
          tableId: input.tableId,
          userId: ctx.session.user.id,
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        filters: z
          .array(
            z.object({
              columnId: z.string(),
              operator: z.enum([
                "gt",
                "lt",
                "isEmpty",
                "isNotEmpty",
                "contains",
                "notContains",
                "equals",
              ]),
              value: z.union([z.string(), z.number()]).optional(),
            }),
          )
          .optional(),
        sorts: z
          .array(
            z.object({
              columnId: z.string(),
              direction: z.enum(["asc", "desc"]),
            }),
          )
          .optional(),
        hiddenColumns: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findUnique({
        where: { id: input.id },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }

      if (view.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update this view",
        });
      }

      return ctx.db.view.update({
        where: { id: input.id },
        data: {
          name: input.name,
          filters: input.filters,
          sorts: input.sorts,
          hiddenColumns: input.hiddenColumns,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findUnique({
        where: { id: input.id },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }

      if (view.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this view",
        });
      }

      return ctx.db.view.delete({
        where: { id: input.id },
      });
    }),
});
