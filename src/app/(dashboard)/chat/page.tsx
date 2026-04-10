import { getCurrentTeacher } from "@/lib/actions/settings";
import { redirect } from "next/navigation";
import { ChatClient } from "@/components/chat/chat-client";

export default async function ChatPage() {
  const currentTeacher = await getCurrentTeacher();

  // 대표(director), 원장(principal), 총괄관리자(admin)만 접근 가능
  if (
    !currentTeacher ||
    !["director", "principal", "admin"].includes(currentTeacher.role ?? "")
  ) {
    redirect("/");
  }

  return <ChatClient userName={currentTeacher.name} />;
}
