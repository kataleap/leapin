-- Phase 5 — order status lifecycle.
--
-- Adds the order-level completion notification type. `orders.status` itself
-- needs no schema change: every value this phase starts writing
-- (pending_payment, in_progress, completed) already exists in the OrderStatus
-- enum from the initial migration — they were simply never written.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'order_completed';
