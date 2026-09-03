/*
  Warnings:

  - You are about to drop the column `file_url` on the `documents_vault` table. All the data in the column will be lost.
  - Added the required column `file_size_bytes` to the `documents_vault` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mime_type` to the `documents_vault` table without a default value. This is not possible if the table is not empty.
  - Added the required column `original_file_name` to the `documents_vault` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storage_path` to the `documents_vault` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "documents_vault" DROP COLUMN "file_url",
ADD COLUMN     "file_size_bytes" INTEGER NOT NULL,
ADD COLUMN     "mime_type" TEXT NOT NULL,
ADD COLUMN     "original_file_name" TEXT NOT NULL,
ADD COLUMN     "storage_path" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "order_activities" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,

    CONSTRAINT "order_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_activities_order_id_activity_id_key" ON "order_activities"("order_id", "activity_id");

-- AddForeignKey
ALTER TABLE "order_activities" ADD CONSTRAINT "order_activities_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_activities" ADD CONSTRAINT "order_activities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
