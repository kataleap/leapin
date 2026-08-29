-- CreateEnum
CREATE TYPE "TrackStatus" AS ENUM ('active', 'deferred');

-- CreateEnum
CREATE TYPE "ActivityCategoryStatus" AS ENUM ('active', 'tbd');

-- CreateEnum
CREATE TYPE "CountryStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "StageTrackScope" AS ENUM ('regular_only', 'entrepreneurship_only', 'shared');

-- CreateEnum
CREATE TYPE "StageActor" AS ENUM ('client', 'team', 'system');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('active', 'deferred', 'tbd');

-- CreateEnum
CREATE TYPE "StagePricingType" AS ENUM ('fixed', 'variable_by_country', 'variable_by_category', 'bundled_only');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('none', 'percentage', 'fixed_amount');

-- CreateEnum
CREATE TYPE "PaymentPlanOwnerType" AS ENUM ('package', 'order');

-- CreateEnum
CREATE TYPE "InstallmentTriggerType" AS ENUM ('on_registration', 'on_stage_complete', 'fixed_date', 'manual');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('client', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "ResidencyStatus" AS ENUM ('resident', 'non_resident');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'pending_payment', 'in_progress', 'completed', 'cancelled', 'on_hold');

-- CreateEnum
CREATE TYPE "OrderStageStatus" AS ENUM ('not_started', 'in_progress', 'waiting_on_client', 'waiting_on_government', 'blocked', 'completed', 'skipped');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "TradeNameStatus" AS ENUM ('submitted', 'approved', 'rejected', 'under_review');

-- CreateEnum
CREATE TYPE "ForeignSetupStatus" AS ENUM ('documents_pending', 'submitted', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('misa_license', 'commercial_register', 'incorporation_contract', 'foreign_company_docs', 'financial_statements', 'other');

-- CreateEnum
CREATE TYPE "GovernmentPlatform" AS ENUM ('zatca', 'gosi', 'absher_nafath', 'other');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('sent', 'replied', 'expired');

-- CreateEnum
CREATE TYPE "PlaceholderStatus" AS ENUM ('pending', 'in_progress', 'completed', 'rejected');

-- CreateTable
CREATE TABLE "tracks" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name_ar" TEXT NOT NULL,
    "description" TEXT,
    "status" "TrackStatus" NOT NULL DEFAULT 'active',
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_categories" (
    "id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name_ar" TEXT NOT NULL,
    "min_foreign_companies" INTEGER,
    "min_capital_sar" DECIMAL(14,2),
    "allowed_in_entrepreneurship" BOOLEAN NOT NULL,
    "status" "ActivityCategoryStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "activity_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_mixing_rules" (
    "id" UUID NOT NULL,
    "base_category_id" UUID NOT NULL,
    "addable_category_id" UUID NOT NULL,
    "is_allowed" BOOLEAN NOT NULL,

    CONSTRAINT "activity_mixing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "duration_min_days" INTEGER NOT NULL,
    "duration_max_days" INTEGER NOT NULL,
    "required_documents" JSONB NOT NULL,
    "poa_required" BOOLEAN NOT NULL,
    "status" "CountryStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_nationality_restrictions" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "nationality_code" VARCHAR(3) NOT NULL,
    "is_eligible" BOOLEAN NOT NULL,

    CONSTRAINT "country_nationality_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "misa_activity_code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "synced_by_admin_id" UUID,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "track_scope" "StageTrackScope" NOT NULL,
    "name_ar" TEXT NOT NULL,
    "description" TEXT,
    "sequence_order" INTEGER NOT NULL,
    "parent_stage_id" UUID,
    "primary_actor" "StageActor" NOT NULL,
    "requires_client_presence" BOOLEAN NOT NULL DEFAULT false,
    "status" "StageStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_pricing" (
    "id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "pricing_type" "StagePricingType" NOT NULL,
    "base_price" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'SAR',
    "notes" TEXT,

    CONSTRAINT "stage_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name_ar" TEXT NOT NULL,
    "track_id" UUID,
    "description" TEXT,
    "total_price_override" DECIMAL(12,2),
    "discount_type" "DiscountType" NOT NULL DEFAULT 'none',
    "discount_value" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_stages" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "is_optional_addon" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "package_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plans" (
    "id" UUID NOT NULL,
    "owner_type" "PaymentPlanOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "installments_count" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_client_selectable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_installments" (
    "id" UUID NOT NULL,
    "payment_plan_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "trigger_type" "InstallmentTriggerType" NOT NULL,
    "trigger_stage_id" UUID,
    "fixed_due_date" DATE,

    CONSTRAINT "payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'client',
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image_url" TEXT,
    "password_hash" TEXT,
    "phone" TEXT,
    "nationality" TEXT,
    "residency_status" "ResidencyStatus",
    "national_id_or_iqama" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "resource" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "activity_category_id" UUID,
    "selected_package_id" UUID,
    "journey_start_stage_id" UUID NOT NULL,
    "journey_end_stage_id" UUID NOT NULL,
    "payment_plan_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "total_price" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_stages" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "status" "OrderStageStatus" NOT NULL DEFAULT 'not_started',
    "assigned_admin_id" UUID,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "internal_notes" TEXT,

    CONSTRAINT "order_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_plan_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "gateway_reference" TEXT,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_names" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "name_ar" TEXT NOT NULL,
    "priority_rank" INTEGER NOT NULL,
    "batch_number" INTEGER NOT NULL,
    "status" "TradeNameStatus" NOT NULL DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foreign_company_setup_requests" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "status" "ForeignSetupStatus" NOT NULL DEFAULT 'documents_pending',
    "poa_status" "PlaceholderStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foreign_company_setup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_vault" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by_admin_id" UUID NOT NULL,
    "is_visible_to_client" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_requests" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "requested_by_admin_id" UUID NOT NULL,
    "government_platform" "GovernmentPlatform" NOT NULL,
    "meta_template_name" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "client_reply" TEXT,
    "client_replied_at" TIMESTAMP(3),
    "status" "OtpStatus" NOT NULL DEFAULT 'sent',

    CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incubator_approvals" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "incubator_name" TEXT NOT NULL,
    "idea_study_status" "PlaceholderStatus" NOT NULL,
    "letter_status" "PlaceholderStatus" NOT NULL,
    "letter_received_at" TIMESTAMP(3),
    "letter_file_url" TEXT,

    CONSTRAINT "incubator_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners_decision_forms" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "template_version" TEXT NOT NULL,
    "signed_partners" JSONB NOT NULL,
    "signed_at" TIMESTAMP(3),
    "file_url" TEXT,

    CONSTRAINT "partners_decision_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_objection_letters" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "status" "PlaceholderStatus" NOT NULL,
    "file_url" TEXT,

    CONSTRAINT "non_objection_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracks_code_key" ON "tracks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "activity_categories_track_id_code_key" ON "activity_categories"("track_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "activity_mixing_rules_base_category_id_addable_category_id_key" ON "activity_mixing_rules"("base_category_id", "addable_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "country_nationality_restrictions_country_id_nationality_cod_key" ON "country_nationality_restrictions"("country_id", "nationality_code");

-- CreateIndex
CREATE INDEX "activities_category_id_idx" ON "activities"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "stages_code_key" ON "stages"("code");

-- CreateIndex
CREATE INDEX "stages_track_scope_idx" ON "stages"("track_scope");

-- CreateIndex
CREATE INDEX "stage_pricing_stage_id_idx" ON "stage_pricing"("stage_id");

-- CreateIndex
CREATE INDEX "packages_track_id_idx" ON "packages"("track_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_stages_package_id_stage_id_key" ON "package_stages"("package_id", "stage_id");

-- CreateIndex
CREATE INDEX "payment_plans_owner_type_owner_id_idx" ON "payment_plans"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "payment_installments_payment_plan_id_idx" ON "payment_installments"("payment_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_resource_key" ON "role_permissions"("role", "resource");

-- CreateIndex
CREATE INDEX "orders_client_id_idx" ON "orders"("client_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_track_id_idx" ON "orders"("track_id");

-- CreateIndex
CREATE INDEX "order_stages_status_idx" ON "order_stages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "order_stages_order_id_stage_id_key" ON "order_stages"("order_id", "stage_id");

-- CreateIndex
CREATE INDEX "order_payments_order_id_idx" ON "order_payments"("order_id");

-- CreateIndex
CREATE INDEX "order_payments_status_idx" ON "order_payments"("status");

-- CreateIndex
CREATE INDEX "trade_names_order_id_idx" ON "trade_names"("order_id");

-- CreateIndex
CREATE INDEX "foreign_company_setup_requests_order_id_idx" ON "foreign_company_setup_requests"("order_id");

-- CreateIndex
CREATE INDEX "documents_vault_order_id_idx" ON "documents_vault"("order_id");

-- CreateIndex
CREATE INDEX "otp_requests_order_id_idx" ON "otp_requests"("order_id");

-- CreateIndex
CREATE INDEX "incubator_approvals_order_id_idx" ON "incubator_approvals"("order_id");

-- CreateIndex
CREATE INDEX "partners_decision_forms_order_id_idx" ON "partners_decision_forms"("order_id");

-- CreateIndex
CREATE INDEX "non_objection_letters_order_id_idx" ON "non_objection_letters"("order_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_user_id_idx" ON "audit_log"("actor_user_id");

-- AddForeignKey
ALTER TABLE "activity_categories" ADD CONSTRAINT "activity_categories_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_mixing_rules" ADD CONSTRAINT "activity_mixing_rules_base_category_id_fkey" FOREIGN KEY ("base_category_id") REFERENCES "activity_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_mixing_rules" ADD CONSTRAINT "activity_mixing_rules_addable_category_id_fkey" FOREIGN KEY ("addable_category_id") REFERENCES "activity_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_nationality_restrictions" ADD CONSTRAINT "country_nationality_restrictions_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "activity_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_synced_by_admin_id_fkey" FOREIGN KEY ("synced_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_parent_stage_id_fkey" FOREIGN KEY ("parent_stage_id") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_pricing" ADD CONSTRAINT "stage_pricing_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_stages" ADD CONSTRAINT "package_stages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_stages" ADD CONSTRAINT "package_stages_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_trigger_stage_id_fkey" FOREIGN KEY ("trigger_stage_id") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_activity_category_id_fkey" FOREIGN KEY ("activity_category_id") REFERENCES "activity_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_selected_package_id_fkey" FOREIGN KEY ("selected_package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_journey_start_stage_id_fkey" FOREIGN KEY ("journey_start_stage_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_journey_end_stage_id_fkey" FOREIGN KEY ("journey_end_stage_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_stages" ADD CONSTRAINT "order_stages_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_names" ADD CONSTRAINT "trade_names_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foreign_company_setup_requests" ADD CONSTRAINT "foreign_company_setup_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foreign_company_setup_requests" ADD CONSTRAINT "foreign_company_setup_requests_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_vault" ADD CONSTRAINT "documents_vault_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_vault" ADD CONSTRAINT "documents_vault_uploaded_by_admin_id_fkey" FOREIGN KEY ("uploaded_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_requests" ADD CONSTRAINT "otp_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_requests" ADD CONSTRAINT "otp_requests_requested_by_admin_id_fkey" FOREIGN KEY ("requested_by_admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incubator_approvals" ADD CONSTRAINT "incubator_approvals_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners_decision_forms" ADD CONSTRAINT "partners_decision_forms_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_objection_letters" ADD CONSTRAINT "non_objection_letters_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
