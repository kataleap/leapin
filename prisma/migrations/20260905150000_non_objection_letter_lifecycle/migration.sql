-- Phase 5 — the sponsor's no-objection letter becomes real.
--
-- Business rule (confirmed with the product owner, and matching doc §5.2's
-- "خطاب عدم ممانعة الكفيل — للمقيم غير السعودي داخل السعودية فقط"): a client
-- who is resident in Saudi Arabia on an iqama must supply a no-objection
-- letter from their employer (their sponsor). The employer issues it, the
-- client uploads it, our team reviews it.
--
-- The table shipped in the very first migration and no code ever touched it:
-- no status lifecycle, and a `file_url` column left over from the pasted-URL
-- upload model that phase 2 §4 replaced everywhere else. It is empty
-- (verified: SELECT count(*) FROM non_objection_letters = 0), so the columns
-- are reshaped in place rather than migrated.

CREATE TYPE "NonObjectionLetterStatus" AS ENUM ('not_submitted', 'under_review', 'approved', 'rejected');

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'non_objection_letter';

ALTER TABLE "non_objection_letters" DROP COLUMN "file_url";
ALTER TABLE "non_objection_letters" DROP COLUMN "status";
ALTER TABLE "non_objection_letters"
  ADD COLUMN "status" "NonObjectionLetterStatus" NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN "document_id" UUID,
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by_admin_id" UUID,
  ADD COLUMN "review_note" TEXT;

ALTER TABLE "non_objection_letters"
  ADD CONSTRAINT "non_objection_letters_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents_vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "non_objection_letters"
  ADD CONSTRAINT "non_objection_letters_reviewed_by_admin_id_fkey"
  FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One letter per order; one letter per uploaded document.
DROP INDEX IF EXISTS "non_objection_letters_order_id_idx";
CREATE UNIQUE INDEX "non_objection_letters_order_id_key" ON "non_objection_letters"("order_id");
CREATE UNIQUE INDEX "non_objection_letters_document_id_key" ON "non_objection_letters"("document_id");
