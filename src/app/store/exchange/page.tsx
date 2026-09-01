import RequestForm from "../returns/request-form";

// Reads the shopper's own orders through the session cookie.
export const dynamic = "force-dynamic";

export default function ExchangePage() {
  return <RequestForm kind="exchange" />;
}
