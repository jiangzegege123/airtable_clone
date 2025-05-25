import { z } from "zod";
import { type Table, Prisma, type CellValue } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { faker } from "@faker-js/faker";

interface RawTableRecord {
  id: string;
  created_at: Date;
  table_id: string;
  value: string | null;
  field_id: string | null;
}

type TableRecordWithCellValues = {
  id: string;
  createdAt: Date;
  tableId: string;
  cellValues: CellValue[];
};

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

      // Create default fields (Name, Email, Phone, Address, Age)
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
      const ageField = await ctx.db.field.create({
        data: {
          name: "Age",
          type: "number",
          order: 4,
          tableId: table.id,
        },
      });

      // Create default view
      await ctx.db.view.create({
        data: {
          name: "Grid view",
          tableId: table.id,
          isDefault: true,
          hiddenFields: [],
        },
      });

      // Generate 10 fake data records
      const records = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          ctx.db.record.create({
            data: {
              tableId: table.id,
            },
          }),
        ),
      );

      // Generate corresponding cell values for each record
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
        {
          recordId: record.id,
          fieldId: ageField.id,
          value: String(faker.number.int({ min: 18, max: 80 })),
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
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(), // Use cursor for infinite query
        viewId: z.string().optional(),
        searchTerm: z.string().optional(),
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

      // Get view if viewId is provided
      let view = null;
      if (input.viewId) {
        view = await ctx.db.view.findUnique({
          where: { id: input.viewId },
          include: {
            filters: {
              include: {
                field: true,
              },
            },
            sorts: {
              orderBy: { order: "asc" },
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
      }

      // Build the where clause with proper type
      const whereClause: Prisma.RecordWhereInput = {
        tableId: input.id,
      };

      // Add cursor condition for pagination
      if (input.cursor) {
        whereClause.id = {
          lt: input.cursor,
        };
      }

      // Add search condition if search term exists
      if (input.searchTerm?.trim()) {
        whereClause.cellValues = {
          some: {
            value: {
              contains: input.searchTerm.trim(),
              mode: "insensitive",
            },
          },
        };
      }

      // Add view filters
      if (view?.filters && view.filters.length > 0) {
        const filterConditions = view.filters.map(
          (filter): Prisma.RecordWhereInput => {
            if (filter.operator === "isEmpty") {
              return {
                cellValues: {
                  none: {
                    fieldId: filter.fieldId,
                  },
                },
              };
            }

            if (filter.operator === "isNotEmpty") {
              return {
                cellValues: {
                  some: {
                    fieldId: filter.fieldId,
                  },
                },
              };
            }

            const value = filter.value ?? "";
            if (
              !value &&
              filter.operator !== "isEmpty" &&
              filter.operator !== "isNotEmpty"
            ) {
              return { id: { not: "" } }; // Always true condition
            }

            switch (filter.operator) {
              case "contains":
                return {
                  cellValues: {
                    some: {
                      fieldId: filter.fieldId,
                      value: {
                        contains: value,
                        mode: "insensitive",
                      },
                    },
                  },
                };
              case "notContains":
                return {
                  NOT: {
                    cellValues: {
                      some: {
                        fieldId: filter.fieldId,
                        value: {
                          contains: value,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                };
              case "equals":
                return {
                  cellValues: {
                    some: {
                      fieldId: filter.fieldId,
                      value: value,
                    },
                  },
                };
              case "greaterThan":
                return {
                  cellValues: {
                    some: {
                      fieldId: filter.fieldId,
                      value: {
                        gt: value,
                      },
                    },
                  },
                };
              case "lessThan":
                return {
                  cellValues: {
                    some: {
                      fieldId: filter.fieldId,
                      value: {
                        lt: value,
                      },
                    },
                  },
                };
              default:
                return { id: { not: "" } }; // Always true condition
            }
          },
        );

        whereClause.AND = filterConditions;
      }

      // Get records with proper sorting and cursor-based pagination
      let records: TableRecordWithCellValues[] = [];
      let nextCursor: string | undefined = undefined;

      if (view?.sorts && view.sorts.length > 0) {
        // Build dynamic ORDER BY clause for raw SQL with proper sort order
        const sortClauses = view.sorts
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) // Ensure proper order
          .map((sort) => {
            const field = table.fields.find((f) => f.id === sort.fieldId);
            if (!field) return null;

            // Create a subquery to get the cell value for sorting
            // Handle both text and number types appropriately
            if (field.type === "number") {
              return `(
                SELECT COALESCE(CAST(cv."value" AS NUMERIC), 0) 
                FROM "CellValue" cv 
                WHERE cv."recordId" = r."id" 
                AND cv."fieldId" = '${sort.fieldId}'
                LIMIT 1
              ) ${sort.direction.toUpperCase()}`;
            } else {
              return `(
                SELECT COALESCE(cv."value", '') 
                FROM "CellValue" cv 
                WHERE cv."recordId" = r."id" 
                AND cv."fieldId" = '${sort.fieldId}'
                LIMIT 1
              ) ${sort.direction.toUpperCase()}`;
            }
          })
          .filter(Boolean)
          .join(", ");

        if (sortClauses) {
          // Build WHERE clause for cursor pagination and filters
          const conditions: string[] = [`r."tableId" = '${input.id}'`];

          // For cursor pagination with custom sorting, we need to use offset instead of cursor
          // This is because cursor-based pagination with complex sorting is very difficult to implement correctly
          let offset = 0;
          if (input.cursor) {
            // Parse cursor as page number for offset-based pagination
            try {
              offset = parseInt(input.cursor) || 0;
            } catch {
              offset = 0;
            }
          }

          // Apply additional filters from view
          if (view.filters && view.filters.length > 0) {
            for (const filter of view.filters) {
              const field = table.fields.find((f) => f.id === filter.fieldId);
              if (!field) continue;

              const cellValueSubquery = `(
                SELECT cv."value" 
                FROM "CellValue" cv 
                WHERE cv."recordId" = r."id" 
                AND cv."fieldId" = '${filter.fieldId}'
                LIMIT 1
              )`;

              switch (filter.operator) {
                case "contains":
                  if (filter.value) {
                    conditions.push(
                      `${cellValueSubquery} ILIKE '%${filter.value}%'`,
                    );
                  }
                  break;
                case "notContains":
                  if (filter.value) {
                    conditions.push(
                      `(${cellValueSubquery} IS NULL OR ${cellValueSubquery} NOT ILIKE '%${filter.value}%')`,
                    );
                  }
                  break;
                case "equals":
                  conditions.push(
                    `${cellValueSubquery} = '${filter.value ?? ""}'`,
                  );
                  break;
                case "isEmpty":
                  conditions.push(
                    `(${cellValueSubquery} IS NULL OR ${cellValueSubquery} = '')`,
                  );
                  break;
                case "isNotEmpty":
                  conditions.push(
                    `${cellValueSubquery} IS NOT NULL AND ${cellValueSubquery} != ''`,
                  );
                  break;
                case "greaterThan":
                  if (filter.value && field.type === "number") {
                    conditions.push(
                      `CAST(${cellValueSubquery} AS NUMERIC) > ${parseFloat(filter.value)}`,
                    );
                  } else if (filter.value) {
                    // For text fields, use string comparison
                    conditions.push(`${cellValueSubquery} > '${filter.value}'`);
                  }
                  break;
                case "lessThan":
                  if (filter.value && field.type === "number") {
                    conditions.push(
                      `CAST(${cellValueSubquery} AS NUMERIC) < ${parseFloat(filter.value)}`,
                    );
                  } else if (filter.value) {
                    // For text fields, use string comparison
                    conditions.push(`${cellValueSubquery} < '${filter.value}'`);
                  }
                  break;
              }
            }
          }

          const whereClause = conditions.join(" AND ");

          // Execute raw SQL query with offset-based pagination for sorting
          const rawRecords = await ctx.db.$queryRaw<
            Array<{ id: string; createdAt: Date; tableId: string }>
          >`
            SELECT r."id", r."createdAt", r."tableId"
            FROM "Record" r
            WHERE ${Prisma.raw(whereClause)}
            ORDER BY ${Prisma.raw(sortClauses)}, r."createdAt" DESC
            LIMIT ${input.limit + 1} OFFSET ${offset}
          `;

          // Get full records with cellValues, preserving order
          if (rawRecords.length > 0) {
            const recordsData = await ctx.db.record.findMany({
              where: {
                id: { in: rawRecords.map((r) => r.id) },
              },
              include: {
                cellValues: true,
              },
            });

            // Maintain the order from raw query
            const recordMap = new Map(recordsData.map((r) => [r.id, r]));
            records = rawRecords
              .map((r) => recordMap.get(r.id)!)
              .filter(Boolean);
          }

          // Update nextCursor to be offset-based for custom sorting
          if (records.length > input.limit) {
            records.pop(); // Remove the extra item
            const nextOffset = offset + input.limit;
            nextCursor = nextOffset.toString();
          }
        } else {
          // Fallback to createdAt if no valid sorts
          records = await ctx.db.record.findMany({
            where: whereClause,
            include: {
              cellValues: true,
            },
            orderBy: { createdAt: "desc" },
            take: input.limit + 1,
          });

          // Use normal cursor pagination for createdAt sorting
          if (records.length > input.limit) {
            const nextItem = records.pop(); // Remove the extra item
            nextCursor = nextItem?.id;
          }
        }
      } else {
        // No sorting - use createdAt desc for consistent pagination
        records = await ctx.db.record.findMany({
          where: whereClause,
          include: {
            cellValues: true,
          },
          orderBy: { createdAt: "desc" },
          take: input.limit + 1,
        });

        // Use normal cursor pagination for createdAt sorting
        if (records.length > input.limit) {
          const nextItem = records.pop(); // Remove the extra item
          nextCursor = nextItem?.id;
        }
      }

      // Transform fields to columns
      const columns = table.fields.map((field) => ({
        id: field.name.toLowerCase(),
        name: field.name,
        type: field.type,
        width: field.name === "Name" ? 200 : 300,
        fieldId: field.id,
        hidden: view?.hiddenFields?.includes(field.id) ?? false,
      }));

      // Create rows based on records and their cell values
      const rows = records.map((record) => {
        const row: { id: string; [key: string]: string | number | null } = {
          id: record.id,
        };

        // Fill in cell values from database
        columns.forEach((column) => {
          const cellValue = record.cellValues.find(
            (cv: CellValue) => cv.fieldId === column.fieldId,
          );
          row[column.id] = cellValue?.value ?? null;
        });

        return row;
      });

      return {
        table,
        columns,
        rows,
        nextCursor,
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

      // Use a transaction with extended timeout for large datasets
      await ctx.db.$transaction(
        async (tx) => {
          // Use the most efficient deletion strategy - delete from most dependent to least

          // Step 1: Delete all cell values (using raw SQL for efficiency)
          await tx.$executeRaw`
            DELETE FROM "CellValue" 
            WHERE "fieldId" IN (
              SELECT "id" FROM "Field" WHERE "tableId" = ${input.id}
            )
          `;

          // Step 2: Delete sorts and filters in parallel
          await Promise.all([
            tx.$executeRaw`
              DELETE FROM "Sort" 
              WHERE "fieldId" IN (
                SELECT "id" FROM "Field" WHERE "tableId" = ${input.id}
              )
            `,
            tx.$executeRaw`
              DELETE FROM "Filter" 
              WHERE "fieldId" IN (
                SELECT "id" FROM "Field" WHERE "tableId" = ${input.id}
              )
            `,
            tx.$executeRaw`
              DELETE FROM "View" WHERE "tableId" = ${input.id}
            `,
          ]);

          // Step 3: Delete records and fields in parallel
          await Promise.all([
            tx.$executeRaw`
              DELETE FROM "Record" WHERE "tableId" = ${input.id}
            `,
            tx.$executeRaw`
              DELETE FROM "Field" WHERE "tableId" = ${input.id}
            `,
          ]);

          // Step 4: Finally delete the table itself
          await tx.table.delete({
            where: { id: input.id },
          });
        },
        {
          timeout: 30000, // 30 seconds timeout
        },
      );

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
          message: "You don't have permission to modify this table",
        });
      }

      // Get existing field count for setting order
      const existingFields = await ctx.db.field.count({
        where: { tableId: input.tableId },
      });

      // Create new field
      const newField = await ctx.db.field.create({
        data: {
          name: input.name,
          type: input.type,
          tableId: input.tableId,
          order: existingFields,
        },
      });

      // Get all records in the table
      const records = await ctx.db.record.findMany({
        where: { tableId: input.tableId },
      });

      // Create cell values for each record (using faker to generate fake data)
      if (records.length > 0) {
        const cellValuesData = records.map((record) => {
          let value = null;

          // Generate fake data based on field type
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

        // Batch create cell values
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
      // Check if table exists and user has access
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

      // Create new record
      const newRecord = await ctx.db.record.create({
        data: {
          tableId: input.tableId,
        },
      });

      // Create cell values for each field (using faker to generate fake data)
      if (table.fields.length > 0) {
        const cellValuesData = table.fields.map((field) => {
          let value = null;

          // Generate appropriate fake data based on field name and type
          if (field.name.toLowerCase() === "name") {
            value = faker.person.fullName();
          } else if (field.name.toLowerCase() === "email") {
            value = faker.internet.email();
          } else if (field.name.toLowerCase() === "phone") {
            value = faker.phone.number();
          } else if (field.name.toLowerCase() === "address") {
            value = faker.location.streetAddress();
          } else if (field.name.toLowerCase() === "age") {
            value = String(faker.number.int({ min: 18, max: 80 }));
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

        // Batch create cell values
        await ctx.db.cellValue.createMany({
          data: cellValuesData,
        });
      }

      return {
        success: true,
        record: newRecord,
      };
    }),

  add100kRows: protectedProcedure
    .input(
      z.object({
        tableId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if table exists and user has access
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

      // Create 100k records in batches of 1000
      const batchSize = 1000;
      const totalRecords = 100000;
      const batches = Math.ceil(totalRecords / batchSize);

      for (let i = 0; i < batches; i++) {
        const recordsToCreate = Math.min(
          batchSize,
          totalRecords - i * batchSize,
        );

        // Create records batch
        const records = await ctx.db.record.createMany({
          data: Array(recordsToCreate).fill({ tableId: input.tableId }),
        });

        // Get the created record IDs
        const createdRecords = await ctx.db.record.findMany({
          where: { tableId: input.tableId },
          orderBy: { createdAt: "desc" },
          take: recordsToCreate,
          select: { id: true },
        });

        // Generate cell values for each record
        const cellValuesData = createdRecords.flatMap((record) =>
          table.fields.map((field) => {
            let value = null;

            // Generate appropriate fake data based on field name/type
            if (field.name.toLowerCase() === "name") {
              value = faker.person.fullName();
            } else if (field.name.toLowerCase() === "email") {
              value = faker.internet.email();
            } else if (field.name.toLowerCase() === "phone") {
              value = faker.phone.number();
            } else if (field.name.toLowerCase() === "address") {
              value = faker.location.streetAddress();
            } else if (field.name.toLowerCase() === "age") {
              value = String(faker.number.int({ min: 18, max: 80 }));
            } else if (field.type === "text") {
              value = faker.lorem.word();
            } else if (field.type === "number") {
              value = String(faker.number.int(100));
            }

            return {
              recordId: record.id,
              fieldId: field.id,
              value,
            };
          }),
        );

        // Create cell values batch
        await ctx.db.cellValue.createMany({
          data: cellValuesData,
        });
      }

      return {
        success: true,
        message: `Added ${totalRecords} rows successfully`,
      };
    }),
});
