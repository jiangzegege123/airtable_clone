/*
  Warnings:

  - The `value` column on the `CellValue` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CellValue" DROP COLUMN "value",
ADD COLUMN     "value" JSONB;
