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

      // Create the table
      const table = await ctx.db.table.create({
        data: {
          name: input.name,
          baseId: input.baseId,
        },
      });

      // Create default fields (Name and Notes)
      const nameField = await ctx.db.field.create({
        data: {
          name: "Name",
          type: "text",
          order: 0,
          tableId: table.id,
        },
      });

      const notesField = await ctx.db.field.create({
        data: {
          name: "Notes",
          type: "text",
          order: 1,
          tableId: table.id,
        },
      });

      // Create two default records with cell values
      const record1 = await ctx.db.record.create({
        data: {
          tableId: table.id,
        },
      });

      const record2 = await ctx.db.record.create({
        data: {
          tableId: table.id,
        },
      });

      // Add cell values for the records
      await ctx.db.cellValue.createMany({
        data: [
          // Record 1 values
          {
            recordId: record1.id,
            fieldId: nameField.id,
            value: "Record 1",
          },
          {
            recordId: record1.id,
            fieldId: notesField.id,
            value: "Add your notes here",
          },
          // Record 2 values
          {
            recordId: record2.id,
            fieldId: nameField.id,
            value: "Record 2",
          },
          {
            recordId: record2.id,
            fieldId: notesField.id,
            value: "Add your notes here",
          },
        ],
      });

      return table;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check if table exists and user has access
      const table = await ctx.db.table.findUnique({
        where: { id: input.id },
        include: {
          base: { select: { ownerId: true } },
          fields: { orderBy: { order: "asc" } },
        },
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

      // Get records from the database with their cell values
      const records = await ctx.db.record.findMany({
        where: { tableId: input.id },
        orderBy: { createdAt: "asc" },
        include: {
          cellValues: {
            include: {
              field: true,
            },
          },
        },
      });

      // Transform fields to columns
      const columns = table.fields.map((field) => ({
        id: field.name.toLowerCase(),
        name: field.name,
        type: field.type,
        width: field.name === "Name" ? 200 : 300,
        fieldId: field.id, // Include the actual field ID for cell updates
      }));

      // Create rows based on records and their cell values
      const rows = records.map((record) => {
        const row: { id: string; [key: string]: string | number | null } = {
          id: record.id,
        };

        // Fill in cell values from database
        columns.forEach((column) => {
          // Find cell value for this column/field
          const cellValue =
            record.cellValues && Array.isArray(record.cellValues)
              ? record.cellValues.find((cv) => cv.fieldId === column.fieldId)
              : undefined;

          // If cell value exists, use it, otherwise use default values
          if (cellValue && cellValue.value) {
            row[column.id] = cellValue.value;
          } else {
            // Use default values for empty cells based on column type
            row[column.id] = null;
          }
        });

        return row;
      });

      return {
        table,
        columns,
        rows,
      };
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

  updateCell: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        recordId: z.string(),
        fieldName: z.string(),
        value: z.union([z.string(), z.number(), z.null()]),
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
          message: "You don't have permission to update this table",
        });
      }

      // Find the field by name
      const field = await ctx.db.field.findFirst({
        where: {
          tableId: input.tableId,
          name: input.fieldName,
        },
      });

      if (!field) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Field "${input.fieldName}" not found`,
        });
      }

      // Check if the record exists
      const record = await ctx.db.record.findUnique({
        where: {
          id: input.recordId,
        },
      });

      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Record not found",
        });
      }

      // Update or create the cell value
      const updatedCell = await ctx.db.cellValue.upsert({
        where: {
          recordId_fieldId: {
            recordId: input.recordId,
            fieldId: field.id,
          },
        },
        update: {
          value: input.value === null ? null : String(input.value),
        },
        create: {
          recordId: input.recordId,
          fieldId: field.id,
          value: input.value === null ? null : String(input.value),
        },
      });

      return { success: true, updatedCell };
    }),
});
