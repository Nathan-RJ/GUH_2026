// Shapes of the JSON the Flask backend returns (see backend/app/services/store.py).

export interface Attachment {
  name: string;
  original_name: string;
  size: number;
  content_type: string | null;
}

export interface Message {
  role: "user" | "assistant";
  text: string;
  created_at: string;
}

export interface Session {
  id: string;
  prompt: string;
  attachments: Attachment[];
  messages: Message[];
  created_at: string;
}
