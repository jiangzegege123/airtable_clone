import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { Table } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { faker } from "@faker-js/faker";

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

      // Create default fields (Name, Email, Phone, Address)
      const nameField = await ctx.db.field.create({
        data: {
          name: "Name",
          type: "text",
          order: 0,
          tableId: table.id,
        },
      });
      const emailField = await ctx.db.field.create({
        data: {
          name: "Email",
          type: "text",
          order: 1,
          tableId: table.id,
        },
      });
      const phoneField = await ctx.db.field.create({
        data: {
          name: "Phone",
          type: "text",
          order: 2,
          tableId: table.id,
        },
      });
      const addressField = await ctx.db.field.create({
        data: {
          name: "Address",
          type: "text",
          order: 3,
          tableId: table.id,
        },
      });

      // 生成 10 条假数据记录
      const records = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          ctx.db.record.create({
            data: {
              tableId: table.id,
            },
          }),
        ),
      );

      // 为每条记录生成对应的 cell values
      const cellValuesData = records.flatMap((record) => [
        {
          recordId: record.id,
          fieldId: nameField.id,
          value: faker.person.fullName(),
        },
        {
          recordId: record.id,
          fieldId: emailField.id,
          value: faker.internet.email(),
        },
        {
          recordId: record.id,
          fieldId: phoneField.id,
          value: faker.phone.number(),
        },
        {
          recordId: record.id,
          fieldId: addressField.id,
          value: faker.location.streetAddress(),
        },
      ]);

      await ctx.db.cellValue.createMany({
        data: cellValuesData,
      });

      return table;
    }),

  getById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        skip: z.number().optional().default(0),
        take: z.number().optional().default(10),
        loadAll: z.boolean().optional().default(false),
      }),
    )
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

      // Get total record count
      const totalCount = await ctx.db.record.count({
        where: { tableId: input.id },
      });

      // Get records from the database with their cell values, with pagination
      const records = await ctx.db.record.findMany({
        where: { tableId: input.id },
        orderBy: { createdAt: "asc" },
        skip: input.loadAll ? 0 : input.skip,
        take: input.loadAll ? undefined : input.take,
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
        pagination: {
          totalCount,
          hasMore: input.loadAll ? false : input.skip + input.take < totalCount,
        },
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

      // 先获取所有相关的字段和记录
      const fields = await ctx.db.field.findMany({
        where: { tableId: input.id },
      });

      const records = await ctx.db.record.findMany({
        where: { tableId: input.id },
      });

      // 删除所有关联的单元格数据
      // 注意：虽然 CellValue 有配置级联删除，但为了确保完全清理，我们先手动删除
      if (fields.length > 0 || records.length > 0) {
        await ctx.db.cellValue.deleteMany({
          where: {
            OR: [
              { fieldId: { in: fields.map((field) => field.id) } },
              { recordId: { in: records.map((record) => record.id) } },
            ],
          },
        });
      }

      // 删除所有字段
      if (fields.length > 0) {
        await ctx.db.field.deleteMany({
          where: { tableId: input.id },
        });
      }

      // 删除所有记录
      if (records.length > 0) {
        await ctx.db.record.deleteMany({
          where: { tableId: input.id },
        });
      }

      // 最后删除表本身
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

  addColumn: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
        name: z.string(),
        type: z.string().default("text"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 检查表是否存在及用户权限
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
          message: "You don't have permission to modify this table",
        });
      }

      // 获取现有字段数量，用于设置顺序
      const existingFields = await ctx.db.field.count({
        where: { tableId: input.tableId },
      });

      // 创建新字段
      const newField = await ctx.db.field.create({
        data: {
          name: input.name,
          type: input.type,
          tableId: input.tableId,
          order: existingFields,
        },
      });

      // 获取表中所有记录
      const records = await ctx.db.record.findMany({
        where: { tableId: input.tableId },
      });

      // 为每条记录创建单元格值（使用 faker 生成假数据）
      if (records.length > 0) {
        const cellValuesData = records.map((record) => {
          let value = null;

          // 根据字段类型生成假数据
          if (input.type === "text") {
            value = faker.lorem.word();
          } else if (input.type === "email") {
            value = faker.internet.email();
          } else if (input.type === "phone") {
            value = faker.phone.number();
          } else if (input.type === "number") {
            value = String(faker.number.int(100));
          } else {
            value = faker.lorem.word();
          }

          return {
            recordId: record.id,
            fieldId: newField.id,
            value: value,
          };
        });

        // 批量创建单元格值
        await ctx.db.cellValue.createMany({
          data: cellValuesData,
        });
      }

      return {
        success: true,
        field: newField,
      };
    }),

  addRow: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 检查表是否存在及用户权限
      const table = await ctx.db.table.findUnique({
        where: { id: input.tableId },
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
          message: "You don't have permission to modify this table",
        });
      }

      // 创建新记录
      const newRecord = await ctx.db.record.create({
        data: {
          tableId: input.tableId,
        },
      });

      // 为每个字段创建单元格值（使用 faker 生成假数据）
      if (table.fields.length > 0) {
        const cellValuesData = table.fields.map((field) => {
          let value = null;

          // 根据字段名称和类型生成适当的假数据
          if (field.name.toLowerCase() === "name") {
            value = faker.person.fullName();
          } else if (field.name.toLowerCase() === "email") {
            value = faker.internet.email();
          } else if (field.name.toLowerCase() === "phone") {
            value = faker.phone.number();
          } else if (field.name.toLowerCase() === "address") {
            value = faker.location.streetAddress();
          } else if (field.type === "text") {
            value = faker.lorem.word();
          } else if (field.type === "number") {
            value = String(faker.number.int(100));
          }

          return {
            recordId: newRecord.id,
            fieldId: field.id,
            value: value,
          };
        });

        // 批量创建单元格值
        await ctx.db.cellValue.createMany({
          data: cellValuesData,
        });
      }

      return {
        success: true,
        record: newRecord,
      };
    }),
});
