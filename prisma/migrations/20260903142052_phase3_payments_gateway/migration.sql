-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('online', 'bank_transfer', 'cash');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'payment_due';
ALTER TYPE "NotificationType" ADD VALUE 'payment_received';

-- AlterTable
ALTER TABLE "order_payments" ADD COLUMN     "checkout_url" TEXT,
ADD COLUMN     "due_at" TIMESTAMP(3),
ADD COLUMN     "method" "PaymentMethod",
ADD COLUMN     "proof_mime_type" TEXT,
ADD COLUMN     "proof_original_file_name" TEXT,
ADD COLUMN     "proof_storage_path" TEXT,
ADD COLUMN     "proof_uploaded_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_gateway_reference_key" ON "order_payments"("gateway_reference");

