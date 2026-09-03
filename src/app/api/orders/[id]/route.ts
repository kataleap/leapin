import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { getOrderForViewer } from "@/lib/orders/get-order-for-viewer";

// Session-dependent data on a fixed URL — without this, a browser can
// serve a different (previously authenticated) user's cached response.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { session, response } = await requireAuth();
  if (response) return response;

  const { id } = await params;
  const { order, forbidden } = await getOrderForViewer(id, session);
  if (forbidden) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ order });
}
