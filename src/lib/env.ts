import { z } from "zod";

// Zod already guards every request body in src/lib/validation/* — configuration
// deserves the same treatment, and got none. The cost of that gap is not
// theoretical: the working .env was missing all four POSTMARK_* variables, so
// every outbound email failed and every email webhook answered 401, and the
// only trace was "failed" rows accumulating in notification_log. Nothing
// crashed, nothing logged at startup, and a client silently stopped being
// told their payment was due.
//
// Validation happens once, at module load, and src/lib/prisma.ts imports this
// so it runs on effectively every server path. A missing secret becomes a
// startup failure naming the variable, not a runtime surprise weeks later.

const url = z.string().url();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SHADOW_DATABASE_URL: z.string().min(1).optional(),

  // NextAuth reads these itself, by its own env-var convention — we never
  // reference them elsewhere in app code, which is exactly why a typo or an
  // omission would otherwise go unnoticed until sign-in broke.
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required — generate with: openssl rand -base64 32"),
  // Used to build absolute links in outbound email and the gateway's return
  // URL. Previously defaulted to http://localhost:3000 at three call sites,
  // which in production means emailing clients dead links and handing Moyasar
  // a localhost redirect.
  AUTH_URL: url,

  MOYASAR_SECRET_KEY: z.string().min(1),
  MOYASAR_WEBHOOK_SECRET: z.string().min(1),
  MOYASAR_BASE_URL: url.default("https://api.moyasar.com/v1"),

  POSTMARK_SERVER_TOKEN: z.string().min(1),
  POSTMARK_FROM_EMAIL: z.string().email(),
  POSTMARK_WEBHOOK_USERNAME: z.string().min(1),
  POSTMARK_WEBHOOK_PASSWORD: z.string().min(1),
  POSTMARK_BASE_URL: url.default("https://api.postmarkapp.com"),

  DOCUMENTS_STORAGE_DIR: z.string().min(1).optional(),

  BANK_TRANSFER_BANK_NAME: z.string().min(1),
  BANK_TRANSFER_ACCOUNT_NAME: z.string().min(1),
  BANK_TRANSFER_IBAN: z.string().min(1),
});

// Outside production the third-party integrations are frequently not
// configured at all, and demanding them would make the app un-runnable for
// anyone working on, say, the journey builder. So they are optional in dev —
// but the adapters still fail closed on a missing key at the point of use,
// and `pnpm build` in CI runs with NODE_ENV=production, so a real deployment
// cannot get past this.
const devSchema = schema.partial({
  MOYASAR_SECRET_KEY: true,
  MOYASAR_WEBHOOK_SECRET: true,
  POSTMARK_SERVER_TOKEN: true,
  POSTMARK_FROM_EMAIL: true,
  POSTMARK_WEBHOOK_USERNAME: true,
  POSTMARK_WEBHOOK_PASSWORD: true,
  BANK_TRANSFER_BANK_NAME: true,
  BANK_TRANSFER_ACCOUNT_NAME: true,
  BANK_TRANSFER_IBAN: true,
  AUTH_URL: true,
});

function load() {
  const isProduction = process.env.NODE_ENV === "production";
  const parsed = (isProduction ? schema : devSchema).safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration (NODE_ENV=${process.env.NODE_ENV ?? "undefined"}):\n${details}\n\n` +
        `See .env.example for the full list of variables and how to obtain each one.`
    );
  }
  return parsed.data;
}

export const env = load();

// The three call sites that build absolute URLs previously each wrote
// `process.env.AUTH_URL ?? "http://localhost:3000"`. Keeping the dev fallback
// in exactly one place means it can never silently differ between them, and
// production has already been forced to set a real value by the schema above.
export function baseUrl(): string {
  return env.AUTH_URL ?? "http://localhost:3000";
}
