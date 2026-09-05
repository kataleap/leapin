import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

const authConfig = (await import("./auth.config")).default;
const { UserRole } = await import("@/generated/prisma/enums");

type Role = "client" | "admin" | "super_admin";

function authorized(pathname: string, role: Role | null) {
  const callback = authConfig.callbacks!.authorized!;
  return callback({
    auth: role === null ? null : ({ user: { role } } as never),
    request: { nextUrl: { pathname } } as never,
  } as never);
}

// This is the proxy-layer gate. It is one of two layers — every page under
// these prefixes also calls requirePageRole, and every API route calls
// requireRole — but it is the layer a misconfiguration would silently remove,
// so its rules are worth pinning down.
describe("authorized (proxy route gating)", () => {
  describe("/superadmin", () => {
    it.each([
      ["/superadmin", "super_admin" as Role, true],
      ["/superadmin/reports", "super_admin" as Role, true],
      ["/superadmin/users", "super_admin" as Role, true],
      ["/superadmin", "admin" as Role, false],
      ["/superadmin/reports", "admin" as Role, false],
      ["/superadmin/users", "client" as Role, false],
    ])("%s as %s => %s", (pathname, role, expected) => {
      expect(authorized(pathname, role)).toBe(expected);
    });

    it("denies an anonymous request", () => {
      expect(authorized("/superadmin/reports", null)).toBe(false);
    });
  });

  describe("/admin", () => {
    it.each([
      ["/admin", "admin" as Role, true],
      ["/admin/orders/abc", "admin" as Role, true],
      // super_admin is a strict superset of admin everywhere else, so it
      // must reach the admin panel too.
      ["/admin", "super_admin" as Role, true],
      ["/admin/orders/abc", "client" as Role, false],
    ])("%s as %s => %s", (pathname, role, expected) => {
      expect(authorized(pathname, role)).toBe(expected);
    });

    it("denies an anonymous request", () => {
      expect(authorized("/admin", null)).toBe(false);
    });
  });

  describe("everything else", () => {
    // Client pages and API routes are deliberately allowed through here and
    // guarded at their own layer — /login and /register must stay reachable
    // while signed out, and API routes answer 401/403 with a body rather than
    // redirecting a fetch to an HTML login page.
    it.each(["/", "/login", "/register", "/journey", "/payments", "/api/orders"])(
      "%s passes through for an anonymous request",
      (pathname) => {
        expect(authorized(pathname, null)).toBe(true);
      }
    );
  });

  // A prefix check on a raw pathname is easy to get subtly wrong.
  describe("prefix matching", () => {
    it("does not let a lookalike path inherit superadmin gating", () => {
      // Not under /superadmin — must not be gated by that branch.
      expect(authorized("/super", "client")).toBe(true);
    });

    it("gates every depth beneath the prefix", () => {
      expect(authorized("/superadmin/a/b/c/d", "admin")).toBe(false);
      expect(authorized("/admin/a/b/c/d", "client")).toBe(false);
    });
  });

  it("uses the role enum values the database actually stores", () => {
    expect(UserRole.super_admin).toBe("super_admin");
    expect(UserRole.admin).toBe("admin");
    expect(UserRole.client).toBe("client");
  });
});
