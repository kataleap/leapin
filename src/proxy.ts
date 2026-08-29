import { NextResponse } from "next/server";

// Placeholder — runs on every request but takes no action yet. Role-based
// route protection (client / admin / super_admin) lands in a later step
// once real authorization logic exists (see src/auth.config.ts).
export function proxy() {
  return NextResponse.next();
}
