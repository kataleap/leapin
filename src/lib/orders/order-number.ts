// Display form of `orders.order_number`. The sequence owns the number; this
// owns only how it reads, so the prefix can change without a migration.
const PREFIX = "LP";
const MIN_DIGITS = 5;

export function formatOrderNumber(orderNumber: number): string {
  return `${PREFIX}-${String(orderNumber).padStart(MIN_DIGITS, "0")}`;
}
