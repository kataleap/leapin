import type { OtpAdapter } from "./adapter";

// Intentional placeholder implementation per doc §4.4: the SMS-vs-WhatsApp
// vendor decision is a parallel, non-blocking cost study, so this phase
// ships with a console-log adapter rather than waiting on it. Swap this for
// a real SMS/WhatsApp adapter later by writing a new implementation of
// OtpAdapter and changing the single `return` in ./index.ts — no call site
// changes needed.
export const consoleOtpAdapter: OtpAdapter = {
  async sendOtp({ to, code }) {
    console.log(`[otp] would send to ${to}: code=${code}`);
    return {};
  },
};
