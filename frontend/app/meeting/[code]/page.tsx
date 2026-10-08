import { Suspense } from "react";
import MeetingRoom from "@/components/meeting/MeetingRoom";

// The meeting room: /meeting/8472916305
export default function MeetingPage({ params }: PageProps<"/meeting/[code]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-room-bg" />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <MeetingRoom code={code.replace(/\D/g, "")} />;
}
