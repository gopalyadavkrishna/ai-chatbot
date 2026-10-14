export type User = { id: number; email: string };

export type Session = { token: string; user: User };

export type Chatbot = {
  id: number;
  name: string;
  description: string;
  system_instructions: string;
  welcome_message: string;
  temperature: number;
};

export type Conversation = {
  id: number;
  chatbot_id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Source = {
  document_name: string;
  page_number: number | null;
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources: Source[];
};

export type ConversationDetail = Conversation & { messages: ChatMessage[] };

export type ChatTurn = {
  conversation: Conversation;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
};

export type KnowledgeDocument = {
  id: number;
  chatbot_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  chunk_count: number;
};
