import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot, query, where, orderBy, setDoc, updateDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export interface MessageAttachment {
  mimeType: string;
  data?: string; // base64 encoded
  url?: string; // HTTPS URL or gs:// URL
  name?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string;
  attachments?: MessageAttachment[];
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: any;
  updatedAt: any;
}

interface ChatContextType {
  chats: Chat[];
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  createNewChat: () => Promise<string>;
  updateChat: (id: string, messages: Message[], title?: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  loading: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

/**
 * ChatProvider manages the state of the user's chats, syncing them with Firestore.
 * It provides functions to create, update, and delete chats.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setChats([]);
      setCurrentChatId(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList: Chat[] = [];
      snapshot.forEach((doc) => {
        chatList.push({ id: doc.id, ...doc.data() } as Chat);
      });
      setChats(chatList);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, [user]);

  /**
   * Creates a new chat session and saves it to Firestore.
   * @returns The ID of the newly created chat.
   */
  const createNewChat = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");
    
    const newChatRef = doc(collection(db, 'chats'));
    const newChat: Omit<Chat, 'id'> = {
      userId: user.uid,
      title: 'Nuova Chat',
      messages: [
        { role: 'assistant', content: 'SmarterRouter v1.0 pronto. Inserisci un prompt per testare i modelli locali o il Master Cloud.', model: 'system' }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(newChatRef, newChat);
      setCurrentChatId(newChatRef.id);
      return newChatRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${newChatRef.id}`);
    }
  }, [user]);

  /**
   * Updates an existing chat with new messages or a new title.
   * Automatically generates a title from the first user message if not provided.
   * Limits the number of messages to 1000 to respect Firestore document size limits.
   * 
   * @param id The ID of the chat to update.
   * @param messages The updated array of messages.
   * @param title An optional new title for the chat.
   */
  const updateChat = useCallback(async (id: string, messages: Message[], title?: string) => {
    if (!user) return;
    const chatRef = doc(db, 'chats', id);
    
    // Limit to 1000 messages to respect Firestore rules
    const limitedMessages = messages.length > 1000 ? messages.slice(-1000) : messages;

    // Strip large base64 data from attachments before saving to Firestore (1MB limit)
    const safeMessages = limitedMessages.map(msg => {
      const cleanMsg: any = { ...msg };
      
      // Remove undefined fields from the message object
      Object.keys(cleanMsg).forEach(key => {
        if (cleanMsg[key] === undefined) {
          delete cleanMsg[key];
        }
      });

      if (cleanMsg.attachments) {
        cleanMsg.attachments = cleanMsg.attachments.map((att: any) => {
          const cleanAtt = { ...att };
          if (cleanAtt.data) {
            delete cleanAtt.data;
            cleanAtt.url = cleanAtt.url || 'local-file-not-saved';
          }
          // Remove undefined fields from the attachment object
          Object.keys(cleanAtt).forEach(key => {
            if (cleanAtt[key] === undefined) {
              delete cleanAtt[key];
            }
          });
          return cleanAtt;
        });
      }
      
      return cleanMsg;
    });

    const updateData: any = {
      messages: safeMessages,
      updatedAt: serverTimestamp()
    };

    if (title) {
      updateData.title = title;
    } else if (safeMessages.length === 2 && safeMessages[1].role === 'user') {
      // Auto-generate title from first user message only when it's added
      const firstMsg = safeMessages[1].content;
      updateData.title = firstMsg.length > 30 ? firstMsg.substring(0, 30) + '...' : firstMsg;
    }

    try {
      await updateDoc(chatRef, updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${id}`);
    }
  }, [user]);

  /**
   * Deletes a chat from Firestore.
   * @param id The ID of the chat to delete.
   */
  const deleteChat = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'chats', id));
      setCurrentChatId(prevId => prevId === id ? null : prevId);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${id}`);
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    chats,
    currentChatId,
    setCurrentChatId,
    createNewChat,
    updateChat,
    deleteChat,
    loading
  }), [chats, currentChatId, createNewChat, updateChat, deleteChat, loading]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
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
