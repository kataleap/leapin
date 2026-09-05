import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/guards";
import { canStaffAccessOrder } from "@/lib/orders/assignment";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { otpRequestSchema } from "@/lib/validation/admin-orders";

type Params = { params: Promise<{ id: string }> };

// Actual WhatsApp Business API delivery is a separate, deferred integration
// (doc §9/§11 — no unified government API, and Meta template approval is a
// prerequisite outside this codebase). This records the request as `sent`;
// wiring it to actually send is later work.
export async function POST(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id: orderId } = await params;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (!(await canStaffAccessOrder(orderId, session))) {
    return NextResponse.json({ error: "This order is not assigned to you." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = otpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const otpRequest = await prisma.otpRequest.create({
      data: {
        orderId,
        requestedByAdminId: session.user.id,
        governmentPlatform: parsed.data.governmentPlatform,
        metaTemplateName: parsed.data.metaTemplateName,
        sentAt: new Date(),
        status: "sent",
      },
    });
    await logAudit({
      actorUserId: session.user.id,
      action: "create_otp_request",
      entityType: "otp_request",
      entityId: otpRequest.id,
      newValue: otpRequest,
    });
    return NextResponse.json({ otpRequest }, { status: 201 });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
