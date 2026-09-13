// Phase 6 — what a staff member may do on one order, as a pure function.
//
// The two inputs come from different places (a stage-assignment query and a
// user-row lookup) and the three call sites that need this decision were
// about to each spell it out by hand. Keeping the rule here means it is
// stated once, and — since it touches nothing but its arguments — it is the
// one part of this permission that can be unit-tested without a database.
export type OrderAccess = {
  /** May read the order: its stages, payments, documents and transfer proofs. */
  canView: boolean;
  /** May confirm a manual payment — bank transfer or cash. Never a gateway payment. */
  canConfirmPayment: boolean;
  /** May attach a document, e.g. the signed contract (§5.5). */
  canUploadDocuments: boolean;
  /**
   * True only when the accounting flag alone granted this access. An admin
   * who is *also* assigned to the order is acting in their ordinary
   * executive capacity, so their audit entries must not be tagged as
   * accounting actions (§6).
   */
  viaAccounting: boolean;
};

const NO_ACCESS: OrderAccess = {
  canView: false,
  canConfirmPayment: false,
  canUploadDocuments: false,
  viaAccounting: false,
};

export function resolveOrderAccess(input: {
  /** super_admin, or an admin holding at least one stage on this order. */
  isAssignedStaff: boolean;
  /** This account carries has_accounting_access. */
  hasAccounting: boolean;
}): OrderAccess {
  if (input.isAssignedStaff) {
    return {
      canView: true,
      canConfirmPayment: true,
      canUploadDocuments: true,
      viaAccounting: false,
    };
  }

  if (input.hasAccounting) {
    // §4: read everything, confirm manual payments, attach the contract —
    // and nothing else. Stages, trade names, the no-objection letter, OTP
    // requests, refunds, and every Moyasar path (checkout links, status
    // sync) stay closed, because those routes keep asking
    // canStaffAccessOrder, which this flag deliberately does not widen.
    return {
      canView: true,
      canConfirmPayment: true,
      canUploadDocuments: true,
      viaAccounting: true,
    };
  }

  return NO_ACCESS;
}
