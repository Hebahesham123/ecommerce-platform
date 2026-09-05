import { ReturnsList } from "../../returns/returns-list";

/** /returns, pinned to the app. One component, two mounts — see /app/orders. */
export default function Page() {
  return <ReturnsList lockChannel="app" />;
}
