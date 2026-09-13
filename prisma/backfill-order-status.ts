// One-off backfill for the order-status lifecycle.
//
// Every order created before this change was written `draft` and never
// updated, so existing rows misreport themselves — including fully paid,
// fully delivered ones. This walks them through the same derivation the
// application now uses on every write, rather than restating that logic in
// migration SQL where the two copies would drift apart.
//
// Idempotent: re-running it is a no-op for orders already in the right state,
// and it never touches an order an admin has put in `cancelled` or `on_hold`.
//
//   pnpm tsx prisma/backfill-order-status.ts
//
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { deriveOrderStatus } from "../src/lib/orders/order-status";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      status: true,
      orderStages: { select: { status: true } },
      orderPayments: { select: { status: true, dueAt: true } },
    },
  });

  let changed = 0;
  for (const order of orders) {
    const next = deriveOrderStatus({
      currentStatus: order.status,
      stages: order.orderStages,
      payments: order.orderPayments,
    });
    if (next === order.status) continue;

    await prisma.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: next },
    });
    changed += 1;
    console.log(`${order.id}: ${order.status} -> ${next}`);
  }

  console.log(`Backfill complete — ${changed} of ${orders.length} orders updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
