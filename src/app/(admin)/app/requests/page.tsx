import { RequestsList } from "../../requests/requests-list";

/** /requests, pinned to the app. One component, two mounts — see /app/orders. */
export default function Page() {
  return <RequestsList lockChannel="app" />;
}
