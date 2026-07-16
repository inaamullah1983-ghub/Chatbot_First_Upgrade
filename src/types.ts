export interface Message {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: number;
  modelUsed?: string;
  sources?: { title: string; url: string }[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}
