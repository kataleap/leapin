import { describe, it, expect } from "vitest";
import { resolveOrderAccess } from "./accounting-access";

describe("resolveOrderAccess", () => {
  it("gives an assigned staff member everything, untagged", () => {
    const access = resolveOrderAccess({ isAssignedStaff: true, hasAccounting: false });
    expect(access).toEqual({
      canView: true,
      canConfirmPayment: true,
      canUploadDocuments: true,
      viaAccounting: false,
    });
  });

  it("gives an accountant with no assignment the three permitted capabilities", () => {
    const access = resolveOrderAccess({ isAssignedStaff: false, hasAccounting: true });
    expect(access.canView).toBe(true);
    expect(access.canConfirmPayment).toBe(true);
    expect(access.canUploadDocuments).toBe(true);
  });

  it("tags the accountant's access so the audit log can distinguish it", () => {
    expect(resolveOrderAccess({ isAssignedStaff: false, hasAccounting: true }).viaAccounting).toBe(true);
  });

  it("does not tag an admin who is both assigned and an accountant", () => {
    // The doc's "admin and accountant on one account" case. They are acting
    // in their ordinary executive capacity on an order they own, so their
    // entries must not read as accounting actions — and the panel must not
    // strip their stage controls.
    const access = resolveOrderAccess({ isAssignedStaff: true, hasAccounting: true });
    expect(access.viaAccounting).toBe(false);
    expect(access.canConfirmPayment).toBe(true);
  });

  it("denies everything to an admin with neither assignment nor the flag", () => {
    const access = resolveOrderAccess({ isAssignedStaff: false, hasAccounting: false });
    expect(access).toEqual({
      canView: false,
      canConfirmPayment: false,
      canUploadDocuments: false,
      viaAccounting: false,
    });
  });
});
