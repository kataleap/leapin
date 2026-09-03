import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { estimateSchema } from "@/lib/validation/journey";
import { calculateOrderPrice, PricingError } from "@/lib/pricing/engine";

export async function POST(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = estimateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const pricing = await calculateOrderPrice(parsed.data);
    return NextResponse.json(pricing);
  } catch (err) {
    if (err instanceof PricingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
