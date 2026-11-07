"use client";

import { ChatView } from "@/components/ChatView";

export default function ChatByIdPage({ params }: { params: { id: string } }) {
  return <ChatView initialChatId={params.id} />;
}