import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { notifyOrderStaff } from "@/lib/notifications";
import { canClientSubmitTradeNames } from "@/lib/orders/client-actions";
import { createTradeNameBatch } from "@/lib/orders/trade-names";
import { clientTradeNameBatchSchema } from "@/lib/validation/client-orders";

type Params = { params: Promise<{ id: string }> };

// Arabic counts don't take one plural form: 1 is singular, 2 is dual, 3–10
// takes the plural, and 11+ returns to the singular accusative. The batch is
// capped at ten, so only the first three cases can occur.
function arabicNameCount(count: number): string {
  if (count === 1) return "اسمًا تجاريًا واحدًا";
  if (count === 2) return "اسمين تجاريين";
  return `${count} أسماء تجارية`;
}

// Phase-2 scope §5.2 asked for this form "بواجهة العميل"; what shipped was an
// admin-only endpoint, so the client had no way to propose their own company
// names — the one thing in the journey nobody but the client can decide.
export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireAuth();
  if (response) return response;

  if (session.user.role !== UserRole.client) {
    return NextResponse.json(
      { error: "Staff submit trade names through the admin order view." },
      { status: 403 }
    );
  }

  const { id: orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      clientId: true,
      status: true,
      tradeNames: { select: { status: true, batchNumber: true } },
    },
  });
  if (!order || order.clientId !== session.user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const verdict = canClientSubmitTradeNames(order.status, order.tradeNames);
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = clientTradeNameBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const tradeNames = await createTradeNameBatch(
      orderId,
      parsed.data.names.map((n) => n.trim())
    );

    await logAudit({
      actorUserId: session.user.id,
      action: "client_submit_trade_name_batch",
      entityType: "order",
      entityId: orderId,
      newValue: tradeNames,
    });

    await notifyOrderStaff(orderId, {
      type: "client_submission",
      title: "العميل قدّم أسماء تجارية",
      message: `قدّم العميل ${arabicNameCount(tradeNames.length)} للمراجعة.`,
    }).catch(() => {});

    return NextResponse.json({ tradeNames }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
