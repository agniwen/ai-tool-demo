import ChatPageClient from "../_components/chat-page-client";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <ChatPageClient initialSessionId={sessionId} />;
}
