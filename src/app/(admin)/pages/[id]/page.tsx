import { notFound } from "next/navigation";
import { pageById } from "@/lib/pages-catalog";
import { PAGE_COPY } from "@/lib/page-copy";
import { getPageCopy } from "@/lib/page-copy-server";
import { samples } from "../samples";
import { PageDetail } from "./page-detail";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = pageById(id);
  if (!entry) notFound();
  const spec = PAGE_COPY[entry.id];
  const [where, copy] = await Promise.all([
    samples(),
    spec ? getPageCopy(spec.section) : Promise.resolve({}),
  ]);
  return <PageDetail page={entry} samples={where} copy={copy} />;
}
