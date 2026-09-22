import { getPageCopy } from "@/lib/page-copy-server";
import { PAGE_COPY } from "@/lib/page-copy";
import { LoginPage } from "./login-page";

// The wording is read per request, so an edit in the dashboard shows up on the
// next load rather than at the next deploy.
export const dynamic = "force-dynamic";

export default async function Page() {
  return <LoginPage copy={await getPageCopy(PAGE_COPY["web-login"].section)} />;
}
