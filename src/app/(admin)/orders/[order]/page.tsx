import { OrderDetailPage } from "../order-detail-page";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ order: string }> }) {
  const { order } = await params;
  return <OrderDetailPage orderNumber={order} basePath="/orders" />;
}
