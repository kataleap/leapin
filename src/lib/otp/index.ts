import { consoleOtpAdapter } from "./console";
import type { OtpAdapter } from "./adapter";

// The one seam a future provider swap uses (doc §4.4) — every call site
// must import from here, never from "./console" directly.
export function getOtpProvider(): OtpAdapter {
  return consoleOtpAdapter;
}

export * from "./adapter";
