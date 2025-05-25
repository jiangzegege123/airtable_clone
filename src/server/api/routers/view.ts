import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const viewRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        tableId: z.string(),
        isDefault: z.boolean().optional(),
        filters: z
          .array(
            z.object({
              fieldId: z.string(),
              operator: z.enum([
                "contains",
                "notContains",
                "equals",
                "isEmpty",
                "isNotEmpty",
                "greaterThan",
                "lessThan",
              ]),
              value: z.string().optional(),
            }),
          )
          .optional(),
        sorts: z
          .array(
            z.object({
              fieldId: z.string(),
              direction: z.enum(["asc", "desc"]),
            }),
          )
          .optional(),
        hiddenFields: z.array(z.string()).optional(),
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

      // If this is the first view for the table, make it the default view
      const existingViews = await ctx.db.view.findMany({
        where: { tableId: input.tableId },
        select: { id: true },
      });

      const shouldBeDefault = existingViews.length === 0 || input.isDefault;

      // If this view should be default, unset any existing default view
      if (shouldBeDefault) {
        await ctx.db.view.updateMany({
          where: { tableId: input.tableId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // Create the view
      const view = await ctx.db.view.create({
        data: {
          name: input.name,
          tableId: input.tableId,
          isDefault: shouldBeDefault,
          hiddenFields: input.hiddenFields ?? [],
          filters: input.filters
            ? {
                create: input.filters.map((filter) => ({
                  fieldId: filter.fieldId,
                  operator: filter.operator,
                  value: filter.value,
                })),
              }
            : undefined,
          sorts: input.sorts
            ? {
                create: input.sorts.map((sort, index) => ({
                  fieldId: sort.fieldId,
                  direction: sort.direction,
                  order: index,
                })),
              }
            : undefined,
        },
        include: {
          filters: true,
          sorts: {
            orderBy: { order: "asc" },
          },
        },
      });

      return view;
    }),

  list: protectedProcedure
    .input(z.object({ tableId: z.string() }))
    .query(async ({ ctx, input }) => {
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
          message: "You don't have permission to view this table",
        });
      }

      // Get all views, with default view first
      const views = await ctx.db.view.findMany({
        where: { tableId: input.tableId },
        include: {
          filters: true,
          sorts: {
            orderBy: { order: "asc" },
          },
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });

      // If no views exist, create a default view
      if (views.length === 0) {
        const defaultView = await ctx.db.view.create({
          data: {
            name: "Grid view",
            tableId: input.tableId,
            isDefault: true,
            hiddenFields: [],
          },
          include: {
            filters: true,
            sorts: {
              orderBy: { order: "asc" },
            },
          },
        });
        return [defaultView];
      }

      return views;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findUnique({
        where: { id: input.id },
        include: { table: { include: { base: true } } },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }

      if (view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this view",
        });
      }

      // Don't allow deleting the default view if it's the only view
      if (view.isDefault) {
        const viewCount = await ctx.db.view.count({
          where: { tableId: view.tableId },
        });
        if (viewCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete the only view",
          });
        }
      }

      await ctx.db.view.delete({
        where: { id: input.id },
      });

      // If we deleted the default view, make the most recent view the new default
      if (view.isDefault) {
        const mostRecentView = await ctx.db.view.findFirst({
          where: { tableId: view.tableId },
          orderBy: { createdAt: "desc" },
        });
        if (mostRecentView) {
          await ctx.db.view.update({
            where: { id: mostRecentView.id },
            data: { isDefault: true },
          });
        }
      }

      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
        filters: z
          .array(
            z.object({
              fieldId: z.string(),
              operator: z.enum([
                "contains",
                "notContains",
                "equals",
                "isEmpty",
                "isNotEmpty",
                "greaterThan",
                "lessThan",
              ]),
              value: z.string().optional(),
            }),
          )
          .optional(),
        sorts: z
          .array(
            z.object({
              fieldId: z.string(),
              direction: z.enum(["asc", "desc"]),
            }),
          )
          .optional(),
        hiddenFields: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findUnique({
        where: { id: input.id },
        include: { table: { include: { base: true } } },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }

      if (view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update this view",
        });
      }

      // If making this view default, unset any existing default view
      if (input.isDefault) {
        await ctx.db.view.updateMany({
          where: {
            tableId: view.tableId,
            isDefault: true,
            id: { not: input.id },
          },
          data: { isDefault: false },
        });
      }

      // Update the view
      const updatedView = await ctx.db.view.update({
        where: { id: input.id },
        data: {
          name: input.name,
          isDefault: input.isDefault,
          hiddenFields: input.hiddenFields,
          filters: input.filters
            ? {
                deleteMany: {},
                create: input.filters.map((filter) => ({
                  fieldId: filter.fieldId,
                  operator: filter.operator,
                  value: filter.value,
                })),
              }
            : undefined,
          sorts: input.sorts
            ? {
                deleteMany: {},
                create: input.sorts.map((sort, index) => ({
                  fieldId: sort.fieldId,
                  direction: sort.direction,
                  order: index,
                })),
              }
            : undefined,
        },
        include: {
          filters: true,
          sorts: {
            orderBy: { order: "asc" },
          },
        },
      });

      return updatedView;
    }),

  getFilters: protectedProcedure
    .input(z.object({ viewId: z.string() }))
    .query(async ({ ctx, input }) => {
      const view = await ctx.db.view.findUnique({
        where: { id: input.viewId },
        include: {
          table: { include: { base: true } },
          filters: {
            include: {
              field: true,
            },
          },
        },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }

      if (view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to access this view",
        });
      }

      return view.filters;
    }),

  getSorts: protectedProcedure
    .input(z.object({ viewId: z.string() }))
    .query(async ({ ctx, input }) => {
      const view = await ctx.db.view.findUnique({
        where: { id: input.viewId },
        include: {
          table: { include: { base: true } },
          sorts: {
            include: {
              field: true,
            },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }

      if (view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to access this view",
        });
      }

      return view.sorts;
    }),

  addFilter: protectedProcedure
    .input(
      z.object({
        viewId: z.string(),
        fieldId: z.string(),
        operator: z.enum([
          "contains",
          "notContains",
          "equals",
          "isEmpty",
          "isNotEmpty",
          "greaterThan",
          "lessThan",
        ]),
        value: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findUnique({
        where: { id: input.viewId },
        include: { table: { include: { base: true } } },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }

      if (view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this view",
        });
      }

      const filter = await ctx.db.filter.create({
        data: {
          viewId: input.viewId,
          fieldId: input.fieldId,
          operator: input.operator,
          value: input.value,
        },
        include: {
          field: true,
        },
      });

      return filter;
    }),

  updateFilter: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        fieldId: z.string(),
        operator: z.enum([
          "contains",
          "notContains",
          "equals",
          "isEmpty",
          "isNotEmpty",
          "greaterThan",
          "lessThan",
        ]),
        value: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const filter = await ctx.db.filter.findUnique({
        where: { id: input.id },
        include: {
          view: {
            include: {
              table: {
                include: {
                  base: true,
                },
              },
            },
          },
        },
      });

      if (!filter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Filter not found",
        });
      }

      if (filter.view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this filter",
        });
      }

      const updatedFilter = await ctx.db.filter.update({
        where: { id: input.id },
        data: {
          fieldId: input.fieldId,
          operator: input.operator,
          value: input.value,
        },
        include: {
          field: true,
        },
      });

      return updatedFilter;
    }),

  deleteFilter: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const filter = await ctx.db.filter.findUnique({
        where: { id: input.id },
        include: {
          view: {
            include: {
              table: {
                include: {
                  base: true,
                },
              },
            },
          },
        },
      });

      if (!filter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Filter not found",
        });
      }

      if (filter.view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this filter",
        });
      }

      await ctx.db.filter.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  addSort: protectedProcedure
    .input(
      z.object({
        viewId: z.string(),
        fieldId: z.string(),
        direction: z.enum(["asc", "desc"]),
        order: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const view = await ctx.db.view.findUnique({
        where: { id: input.viewId },
        include: { table: { include: { base: true } } },
      });

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }

      if (view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this view",
        });
      }

      const sort = await ctx.db.sort.create({
        data: {
          viewId: input.viewId,
          fieldId: input.fieldId,
          direction: input.direction,
          order: input.order,
        },
        include: {
          field: true,
        },
      });

      return sort;
    }),

  updateSort: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        fieldId: z.string(),
        direction: z.enum(["asc", "desc"]),
        order: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sort = await ctx.db.sort.findUnique({
        where: { id: input.id },
        include: {
          view: {
            include: {
              table: {
                include: {
                  base: true,
                },
              },
            },
          },
        },
      });

      if (!sort) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sort not found",
        });
      }

      if (sort.view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this sort",
        });
      }

      const updatedSort = await ctx.db.sort.update({
        where: { id: input.id },
        data: {
          fieldId: input.fieldId,
          direction: input.direction,
          order: input.order,
        },
        include: {
          field: true,
        },
      });

      return updatedSort;
    }),

  deleteSort: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sort = await ctx.db.sort.findUnique({
        where: { id: input.id },
        include: {
          view: {
            include: {
              table: {
                include: {
                  base: true,
                },
              },
            },
          },
        },
      });

      if (!sort) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sort not found",
        });
      }

      if (sort.view.table.base.ownerId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this sort",
        });
      }

      await ctx.db.sort.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
