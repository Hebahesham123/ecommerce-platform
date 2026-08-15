import { Customizer } from "./customizer";

export const dynamic = "force-dynamic";

export default async function CustomizeThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Customizer themeId={id} />;
}
