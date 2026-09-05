-- CreateEnum
CREATE TYPE "LoginOtpPurpose" AS ENUM ('login', 'phone_change');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone_verified_at" TIMESTAMP(3),
ADD COLUMN     "pending_phone" TEXT,
ADD COLUMN     "address_country" TEXT,
ADD COLUMN     "address_city" TEXT,
ADD COLUMN     "address_postal_code" TEXT;

-- CreateTable
CREATE TABLE "login_otp_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "LoginOtpPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "new_phone" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_otp_codes_user_id_idx" ON "login_otp_codes"("user_id");

-- AddForeignKey
ALTER TABLE "login_otp_codes" ADD CONSTRAINT "login_otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
