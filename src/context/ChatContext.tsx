import React, { ReactNode, createContext, useContext } from 'react';
import { useChatLogic, Chat, Message, MessageAttachment } from '../features/chat/hooks/useChatLogic';

export type { Chat, Message, MessageAttachment };

const ChatContext = createContext<ReturnType<typeof useChatLogic> | undefined>(undefined);

/**
 * ChatProvider manages the state of the user's chats, syncing them with Firestore.
 * It provides functions to create, update, and delete chats.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  // Initialize chat subscription
  const chatLogic = useChatLogic();
  return <ChatContext.Provider value={chatLogic}>{children}</ChatContext.Provider>;
}

/**
 * Custom hook to access the chat context.
 * Must be used within a ChatProvider.
 */
export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
