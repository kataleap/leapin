-- Phase 5 (platform audit remediation) — integrity constraints that make the
-- payment/notification ledgers structurally correct rather than correct only
-- by convention.
--
-- Both are safe to apply to an existing database only if no duplicates are
-- already present; verified empty on the dev database before this was
-- written. Re-verify before applying to staging/production:
--
--   SELECT order_id, installment_number, count(*) FROM order_payments
--     GROUP BY 1,2 HAVING count(*) > 1;
--   SELECT provider_reference, count(*) FROM notification_log
--     WHERE provider_reference IS NOT NULL GROUP BY 1 HAVING count(*) > 1;

-- CreateIndex
CREATE UNIQUE INDEX "notification_log_provider_reference_key" ON "notification_log"("provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_order_id_installment_number_key" ON "order_payments"("order_id", "installment_number");
