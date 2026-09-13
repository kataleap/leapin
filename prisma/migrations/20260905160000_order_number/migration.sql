-- Phase 5 — a human-readable order reference.
--
-- Clients were shown the UUID primary key: unreadable, unquotable over the
-- phone, and useless in a support conversation. A Postgres sequence owns the
-- numbering so concurrent inserts can never collide; the display prefix
-- (LP-…) is presentation and lives in the application.
--
-- Existing rows are numbered by creation order, so the oldest order is #1.

CREATE SEQUENCE "orders_order_number_seq";

ALTER TABLE "orders" ADD COLUMN "order_number" INTEGER;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM "orders"
)
UPDATE "orders" o SET "order_number" = numbered.rn FROM numbered WHERE o.id = numbered.id;

SELECT setval('orders_order_number_seq', COALESCE((SELECT MAX("order_number") FROM "orders"), 0) + 1, false);

ALTER TABLE "orders"
  ALTER COLUMN "order_number" SET NOT NULL,
  ALTER COLUMN "order_number" SET DEFAULT nextval('orders_order_number_seq');

ALTER SEQUENCE "orders_order_number_seq" OWNED BY "orders"."order_number";

CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
