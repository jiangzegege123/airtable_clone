-- CreateTable
CREATE TABLE "CellValue" (
    "id" TEXT NOT NULL,
    "value" TEXT,
    "recordId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,

    CONSTRAINT "CellValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CellValue_recordId_fieldId_key" ON "CellValue"("recordId", "fieldId");

-- AddForeignKey
ALTER TABLE "CellValue" ADD CONSTRAINT "CellValue_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CellValue" ADD CONSTRAINT "CellValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE CASCADE ON UPDATE CASCADE;
