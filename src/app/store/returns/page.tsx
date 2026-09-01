import RequestForm from "./request-form";

// Reads the shopper's own orders through the session cookie.
export const dynamic = "force-dynamic";

export default function ReturnsPage() {
  return <RequestForm kind="return" />;
}
