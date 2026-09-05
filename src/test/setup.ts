// src/lib/env.ts validates configuration at import time, and several modules
// under test import it transitively. Give the suite a minimal valid
// environment so a developer's missing .env can never be the reason a test
// fails — the point of these tests is the logic, not the config.
// NODE_ENV is typed read-only by @types/node; Vitest already sets it to
// "test", so this only needs to hold for a stray runner that doesn't.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/leapin_test";
process.env.AUTH_SECRET ??= "test-secret-not-used-for-anything-real";
process.env.AUTH_URL ??= "http://localhost:3000";
