import type { ReactNode } from "react";
import ChatLayoutShell from "./_components/chat-layout-shell";

export default function ChatLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ChatLayoutShell>{children}</ChatLayoutShell>;
}
