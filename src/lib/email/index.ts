import { postmarkAdapter } from "./postmark";
import type { EmailAdapter } from "./adapter";

// The one seam a future provider swap uses (doc §4.3) — every call site
// must import from here, never from "./postmark" directly.
export function getEmailProvider(): EmailAdapter {
  return postmarkAdapter;
}

export * from "./adapter";
