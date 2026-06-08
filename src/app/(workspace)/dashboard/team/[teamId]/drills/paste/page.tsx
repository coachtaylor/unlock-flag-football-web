import PasteLinkClient from "./PasteLinkClient";

export default async function PasteDrillPage({
  params,
}: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <PasteLinkClient teamId={teamId} />;
}
