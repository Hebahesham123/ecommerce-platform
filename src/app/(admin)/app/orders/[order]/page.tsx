import { OrderDetailPage } from "../../../orders/order-detail-page";

export const dynamic = "force-dynamic";

/** The same full-page order view as /orders/[order], reached from the app list. */
export default async function Page({ params }: { params: Promise<{ order: string }> }) {
  const { order } = await params;
  return <OrderDetailPage orderNumber={order} basePath="/app/orders" />;
}
