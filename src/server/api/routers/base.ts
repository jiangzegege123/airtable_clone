import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { Base } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const baseRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<Base> => {
      return ctx.db.base.create({
        data: {
          name: input.name,
          ownerId: ctx.session.user.id,
        },
      });
    }),

  list: protectedProcedure.query(async ({ ctx }): Promise<Base[]> => {
    return ctx.db.base.findMany({
      where: {
        ownerId: ctx.session.user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }): Promise<Base | null> => {
      const base = await ctx.db.base.findUnique({
        where: { id: input.id },
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
          message: "You don't have permission to access this base",
        });
      }

      return base;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Check if base exists and belongs to current user
      const base = await ctx.db.base.findUnique({
        where: { id: input.id },
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
          message: "You don't have permission to delete this base",
        });
      }

      // Delete the base
      await ctx.db.base.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
