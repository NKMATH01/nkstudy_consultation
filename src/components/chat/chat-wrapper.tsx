"use client";

import dynamic from "next/dynamic";

const ChatPopup = dynamic(
  () => import("./chat-client").then((m) => m.ChatPopup),
  { ssr: false }
);

interface Props {
  userName: string;
}

export function ChatWrapper({ userName }: Props) {
  return <ChatPopup userName={userName} />;
}
