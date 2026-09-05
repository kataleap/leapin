-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email');

-- CreateEnum
CREATE TYPE "NotificationLogEventType" AS ENUM ('stage_completed', 'waiting_on_client', 'payment_due');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('sent', 'failed', 'bounced');

-- CreateTable
CREATE TABLE "notification_log" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "event_type" "NotificationLogEventType" NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "status" "NotificationLogStatus" NOT NULL,
    "provider_reference" TEXT,
    "error_message" TEXT,
    "subject" TEXT,
    "body_html" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_log_order_id_idx" ON "notification_log"("order_id");

-- CreateIndex
CREATE INDEX "notification_log_status_idx" ON "notification_log"("status");

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
