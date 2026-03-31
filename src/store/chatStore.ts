import { create } from 'zustand';
import { collection, doc, onSnapshot, query, where, orderBy, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
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

interface ChatState {
  chats: Chat[];
  currentChatId: string | null;
  loading: boolean;
  unsubscribeSnapshot: (() => void) | null;
  
  setChats: (chats: Chat[]) => void;
  setCurrentChatId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  
  subscribeToChats: (userId: string | undefined) => void;
  createNewChat: (userId: string) => Promise<string | undefined>;
  updateChat: (userId: string, id: string, messages: Message[], title?: string) => Promise<void>;
  deleteChat: (userId: string, id: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
  loading: true,
  unsubscribeSnapshot: null,

  setChats: (chats) => set({ chats }),
  setCurrentChatId: (id) => set({ currentChatId: id }),
  setLoading: (loading) => set({ loading }),

  subscribeToChats: (userId) => {
    const { unsubscribeSnapshot } = get();
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      set({ unsubscribeSnapshot: null });
    }

    if (!userId) {
      set({ chats: [], currentChatId: null, loading: false });
      return;
    }

    set({ loading: true });
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList: Chat[] = [];
      snapshot.forEach((doc) => {
        chatList.push({ id: doc.id, ...doc.data() } as Chat);
      });
      set({ chats: chatList, loading: false });
    }, (error) => {
      set({ loading: false });
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    set({ unsubscribeSnapshot: unsubscribe });
  },

  createNewChat: async (userId) => {
    if (!userId) throw new Error("User not authenticated");
    
    const newChatRef = doc(collection(db, 'chats'));
    const newChat: Omit<Chat, 'id'> = {
      userId: userId,
      title: 'Nuova Chat',
      messages: [
        { role: 'assistant', content: 'SmarterRouter v1.0 pronto. Inserisci un prompt per testare i modelli locali o il Master Cloud.', model: 'system' }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(newChatRef, newChat);
      set({ currentChatId: newChatRef.id });
      return newChatRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${newChatRef.id}`);
    }
  },

  updateChat: async (userId, id, messages, title) => {
    if (!userId) return;
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
  },

  deleteChat: async (userId, id) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'chats', id));
      const { currentChatId } = get();
      if (currentChatId === id) {
        set({ currentChatId: null });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${id}`);
    }
  }
}));
