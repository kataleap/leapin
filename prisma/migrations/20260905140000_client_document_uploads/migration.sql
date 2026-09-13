-- Phase 5 — client-supplied documents (phase-2 scope §4.2).
--
-- documents_vault was modelled for one source only: an admin uploading a
-- deliverable into the client's vault. A client uploading their own papers
-- (attested foreign-company documents, financial statements) has no admin
-- uploader, so the column is relaxed to nullable and a client-side column is
-- added beside it. The CHECK is what keeps "nullable" from meaning "unknown":
-- every document has exactly one uploader, never zero and never both.
--
-- Existing rows are all admin uploads, so they satisfy the constraint as-is.

ALTER TABLE "documents_vault" ALTER COLUMN "uploaded_by_admin_id" DROP NOT NULL;

ALTER TABLE "documents_vault" ADD COLUMN "uploaded_by_client_id" UUID;

ALTER TABLE "documents_vault"
  ADD CONSTRAINT "documents_vault_uploaded_by_client_id_fkey"
  FOREIGN KEY ("uploaded_by_client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "documents_vault"
  ADD CONSTRAINT "documents_vault_exactly_one_uploader"
  CHECK (num_nonnulls("uploaded_by_admin_id", "uploaded_by_client_id") = 1);

CREATE INDEX "documents_vault_uploaded_by_client_id_idx" ON "documents_vault"("uploaded_by_client_id");
