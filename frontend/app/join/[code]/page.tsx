import { Suspense } from "react";
import PreJoin from "@/components/PreJoin";

// The invite link: /join/8472916305
export default function JoinByLinkPage({ params }: PageProps<"/join/[code]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-room-bg" />}>
      <JoinWithCode params={params} />
    </Suspense>
  );
}

async function JoinWithCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PreJoin code={code.replace(/\D/g, "")} />;
}
