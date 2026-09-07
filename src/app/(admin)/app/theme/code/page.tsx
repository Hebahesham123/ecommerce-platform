import { Suspense } from "react";
import { CodeView } from "./code-view";

export default function Page() {
  // useSearchParams needs a boundary; the file to open arrives as ?file=.
  return (
    <Suspense fallback={null}>
      <CodeView />
    </Suspense>
  );
}
