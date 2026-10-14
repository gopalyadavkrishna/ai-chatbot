import ConversationStudio from "./conversation-studio";

export default async function ChatbotChatPage({
  params,
}: {
  params: Promise<{ chatbotId: string }>;
}) {
  const { chatbotId } = await params;

  return <ConversationStudio chatbotId={chatbotId} />;
}
