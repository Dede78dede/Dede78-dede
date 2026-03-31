import { useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useChatStore, Chat, Message, MessageAttachment } from '../../../store/chatStore';

export type { Chat, Message, MessageAttachment };

export function useChatLogic() {
  const { user } = useAuth();
  const store = useChatStore();
  const subscribeToChats = useChatStore(state => state.subscribeToChats);

  useEffect(() => {
    subscribeToChats(user?.uid);
  }, [user?.uid, subscribeToChats]);

  const createNewChat = useCallback(() => {
    if (!user) return Promise.reject(new Error("User not authenticated"));
    return store.createNewChat(user.uid);
  }, [user, store.createNewChat]);

  const updateChat = useCallback((id: string, messages: Message[], title?: string) => {
    if (!user) return Promise.resolve();
    return store.updateChat(user.uid, id, messages, title);
  }, [user, store.updateChat]);

  const deleteChat = useCallback((id: string) => {
    if (!user) return Promise.resolve();
    return store.deleteChat(user.uid, id);
  }, [user, store.deleteChat]);

  return {
    chats: store.chats,
    currentChatId: store.currentChatId,
    setCurrentChatId: store.setCurrentChatId,
    createNewChat,
    updateChat,
    deleteChat,
    loading: store.loading
  };
}
