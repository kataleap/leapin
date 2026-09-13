-- Phase 5 — a staff-facing notification type for client submissions
-- (documents, trade-name batches). Distinct from stage_status_changed, which
-- is client-facing and routes to the client's own order page.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'client_submission';
