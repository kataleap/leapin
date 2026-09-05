import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { baseUrl } from "@/lib/env";
import { UserRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { handlePrismaError } from "@/lib/api-errors";
import { stageUpdateInputSchema } from "@/lib/validation/admin-orders";
import { createNotification } from "@/lib/notifications";
import { sendExternalNotification } from "@/lib/email/send-external-notification";

type Params = { params: Promise<{ id: string; stageId: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { session, response } = await requireRole([UserRole.admin, UserRole.super_admin]);
  if (response) return response;

  const { id: orderId, stageId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = stageUpdateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { status, assignedAdminId, internalNotes } = parsed.data;

  const orderStage = await prisma.orderStage.findUnique({
    where: { orderId_stageId: { orderId, stageId } },
  });
  if (!orderStage) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const isSuperAdmin = session.user.role === UserRole.super_admin;

  // Reassignment (§2.2: "super admin is the sole party who... determines the
  // scope of orders assigned to each admin") is a super_admin-only action.
  if (assignedAdminId !== undefined && !isSuperAdmin) {
    return NextResponse.json({ error: "Only a super admin can reassign a stage." }, { status: 403 });
  }

  // Per §2.1: an admin only manages stages already assigned to them.
  if (!isSuperAdmin && orderStage.assignedAdminId !== session.user.id) {
    return NextResponse.json({ error: "This stage is not assigned to you." }, { status: 403 });
  }

  // `skipped` is an order-creation-time-only state (doc §7.1) — never a
  // valid manual transition source or target.
  if (orderStage.status === "skipped") {
    return NextResponse.json(
      { error: "This stage is skipped for this order and cannot be updated." },
      { status: 409 }
    );
  }
  if (status === "skipped") {
    return NextResponse.json({ error: "A stage cannot be manually set to 'skipped'." }, { status: 400 });
  }
  if (orderStage.status === "completed" && status && status !== "completed") {
    return NextResponse.json({ error: "A completed stage cannot be reopened." }, { status: 409 });
  }

  const data: Prisma.OrderStageUncheckedUpdateInput = {};
  if (assignedAdminId !== undefined) data.assignedAdminId = assignedAdminId;
  if (internalNotes !== undefined) data.internalNotes = internalNotes;
  if (status !== undefined) {
    data.status = status;
    if (status === "in_progress" && !orderStage.startedAt) data.startedAt = new Date();
    if (status === "completed") data.completedAt = new Date();
  }

  const statusChanged = status !== undefined && status !== orderStage.status;

  try {
    // Completing a stage and activating the installment that stage triggers
    // are one fact, so they commit together. Split across two writes, a crash
    // between them left the stage complete and the installment dormant
    // *permanently*: re-saving the stage yields statusChanged === false, so
    // the activation below would never run again, and nothing surfaced an
    // error to anyone. Silent revenue loss.
    const { updated, activatedInstallments } = await prisma.$transaction(async (tx) => {
      const updated = await tx.orderStage.update({
        where: { orderId_stageId: { orderId, stageId } },
        data,
      });

      // Phase 3 §4.3: completing a stage can activate an on_stage_complete
      // installment — mark it payable (dueAt). No gateway call here; a
      // checkout URL is only ever created on demand (see the checkout route)
      // so this never depends on Moyasar being reachable.
      const activatedInstallments: number[] = [];
      if (statusChanged && status === "completed") {
        const triggeringInstallments = await tx.paymentInstallment.findMany({
          where: { triggerStageId: stageId, triggerType: "on_stage_complete" },
          select: { paymentPlanId: true, installmentNumber: true },
        });
        for (const inst of triggeringInstallments) {
          // Conditional update rather than read-then-write: `dueAt: null` in
          // the filter is what makes this idempotent, so a concurrent or
          // repeated completion can never activate the same installment twice.
          const claimed = await tx.orderPayment.updateMany({
            where: {
              orderId,
              paymentPlanId: inst.paymentPlanId,
              installmentNumber: inst.installmentNumber,
              dueAt: null,
              status: "pending",
            },
            data: { dueAt: new Date() },
          });
          if (claimed.count > 0) activatedInstallments.push(inst.installmentNumber);
        }
      }

      return { updated, activatedInstallments };
    });

    await logAudit({
      actorUserId: session.user.id,
      action: "update_order_stage",
      entityType: "order_stage",
      entityId: updated.id,
      oldValue: orderStage,
      newValue: updated,
    });

    // Doc §10.2 notification triggers — side effects, must never fail the
    // update itself, and deliberately after the transaction commits: an
    // email provider being slow or down must not hold a DB transaction open.
    if (statusChanged || assignedAdminId) {
      const base = baseUrl();
      const [order, stage] = await Promise.all([
        prisma.order.findUnique({ where: { id: orderId }, select: { clientId: true, client: { select: { email: true } } } }),
        prisma.stage.findUnique({ where: { id: stageId }, select: { nameAr: true } }),
      ]);
      const stageLabel = stage?.nameAr ?? stageId;

      if (statusChanged && order) {
        await createNotification({
          userId: order.clientId,
          type: "stage_status_changed",
          title: "تحديث في حالة طلبك",
          message: `تغيّرت حالة مرحلة "${stageLabel}" إلى ${status}.`,
          orderId,
        }).catch(() => {});

        // Phase 4 doc §5.1: an external email fires only at these two
        // meaningful moments, not on every internal status change.
        if (status === "completed" || status === "waiting_on_client") {
          await sendExternalNotification({
            orderId,
            recipientEmail: order.client.email,
            eventType: status === "completed" ? "stage_completed" : "waiting_on_client",
            title: "تحديث في حالة طلبك",
            message: `تغيّرت حالة مرحلة "${stageLabel}" إلى ${status}.`,
            link: `${base}/orders/${orderId}`,
          });
        }
      }
      if (assignedAdminId) {
        await createNotification({
          userId: assignedAdminId,
          type: "stage_assigned",
          title: "تم إسناد مرحلة إليك",
          message: `أُسندت إليك مرحلة "${stageLabel}".`,
          orderId,
        }).catch(() => {});
      }

      // Tell the client about each installment the transaction above actually
      // activated — the list is what committed, not what we hoped would.
      if (order) {
        for (const installmentNumber of activatedInstallments) {
          const paymentDueTitle = "دفعة مستحقة على طلبك";
          const paymentDueMessage = `أصبحت الدفعة رقم ${installmentNumber} مستحقة الدفع. يرجى زيارة صفحة "مدفوعاتي" لإتمام السداد.`;
          await createNotification({
            userId: order.clientId,
            type: "payment_due",
            title: paymentDueTitle,
            message: paymentDueMessage,
            orderId,
          }).catch(() => {});
          await sendExternalNotification({
            orderId,
            recipientEmail: order.client.email,
            eventType: "payment_due",
            title: paymentDueTitle,
            message: paymentDueMessage,
            link: `${base}/payments`,
          });
        }
      }
    }

    return NextResponse.json({ orderStage: updated });
  } catch (err) {
    const handled = handlePrismaError(err);
    if (handled) return handled;
    throw err;
  }
}
