import { Suspense } from "react";
import RequestHub from "./request-hub";

// Reads the shopper's own orders through the session cookie.
export const dynamic = "force-dynamic";

/**
 * The Requests page shoppers actually land on, rendered inside the theme's
 * header and footer by the storefront handler's widget-page route.
 */
export default function StoreRequestsPage() {
  return (
    <Suspense fallback={null}>
      <RequestHub />
    </Suspense>
  );
}
