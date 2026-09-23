import { NextResponse } from "next/server";
import { getPaymentMethods } from "@/lib/payments-server";

export const dynamic = "force-dynamic";

/**
 * What the shop accepts, for the app's checkout.
 *
 * The same list the website's checkout is built from, so a shopper is never
 * offered on one storefront what the other has never heard of. Read-only and
 * public: it is the row of options a checkout already shows everybody.
 */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, data: await getPaymentMethods() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
