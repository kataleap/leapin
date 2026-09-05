import { moyasarAdapter } from "./moyasar";
import type { PaymentGatewayAdapter } from "./adapter";

// The one seam a future provider swap uses (doc §3.3) — every call site
// must import from here, never from "./moyasar" directly.
export function getPaymentGateway(): PaymentGatewayAdapter {
  return moyasarAdapter;
}

export * from "./adapter";
