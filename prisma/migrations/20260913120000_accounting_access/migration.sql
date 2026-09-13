-- Phase 6 §3.1 — the accounting permission.
--
-- A flag on the individual account rather than a fourth value in the
-- "UserRole" enum. The enum answers "what kind of account is this"; this
-- column answers "may this particular account see every client's money".
-- Keeping them separate is what lets one account be admin and accountant at
-- once, and lets the permission be revoked without touching the account's
-- role or its stage assignments.
--
-- Defaults to false, so every existing account — including super admins —
-- starts without it and the new section stays invisible until a super admin
-- grants it explicitly (§5.1).
--
-- Never set on a client account. That invariant is enforced in the API
-- (POST/PUT /api/superadmin/users), not by a CHECK constraint, so that
-- demoting an admin to client repairs the flag instead of failing the write.

ALTER TABLE "users" ADD COLUMN "has_accounting_access" BOOLEAN NOT NULL DEFAULT false;
