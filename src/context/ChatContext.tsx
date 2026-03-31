import React, { ReactNode } from 'react';
import { useChatLogic, Chat, Message, MessageAttachment } from '../features/chat/hooks/useChatLogic';

export type { Chat, Message, MessageAttachment };

/**
 * ChatProvider manages the state of the user's chats, syncing them with Firestore.
 * It provides functions to create, update, and delete chats.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  // Initialize chat subscription
  useChatLogic();
  return <>{children}</>;
}

/**
 * Custom hook to access the chat context.
 * Must be used within a ChatProvider.
 */
export function useChat() {
  return useChatLogic();
}
