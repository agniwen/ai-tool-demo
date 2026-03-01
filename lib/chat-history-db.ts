import Dexie, { type EntityTable } from "dexie";
import type { UIMessage } from "ai";

export type StoredConversation = {
  id: string;
  title: string;
  isTitleGenerating?: boolean;
  createdAt: number;
  updatedAt: number;
  jobDescription: string;
  messages: UIMessage[];
};

class ChatHistoryDB extends Dexie {
  conversations!: EntityTable<StoredConversation, "id">;

  constructor() {
    super("chat-history-db");
    this.version(1).stores({
      conversations: "&id, updatedAt, createdAt",
    });
  }
}

export const chatHistoryDB = new ChatHistoryDB();
