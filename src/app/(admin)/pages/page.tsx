import { PagesHub } from "./pages-hub";
import { samples } from "./samples";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <PagesHub samples={await samples()} />;
}
