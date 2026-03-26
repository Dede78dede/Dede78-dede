import { collection, doc, setDoc, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

import { Message } from '../context/ChatContext';

/**
 * Represents the result of a memory query, including the source of the data.
 */
export interface MemoryResult {
  source: 'L1 (RAM)' | 'L2 (Disk)' | 'L3 (Semantic)' | 'L4 (Compute)';
  response: string;
}

/**
 * MemorySystem provides a multi-tiered caching architecture for LLM responses.
 * L1: In-memory RAM cache (fastest, ephemeral).
 * L2: LocalStorage disk cache (persistent across reloads).
 * L3: Semantic cache synced via Firestore (cross-device, semantic matching).
 * L4: Actual Compute (calling the LLM).
 */
export class MemorySystem {
  // L1: RAM Cache (Fastest, clears on reload)
  private l1Cache = new Map<string, string>();
  
  // L3: Synced from Firestore
  private l3Cache = new Map<string, { id: string, query: string, response: string }>();
  private unsubscribeL3: (() => void) | null = null;
  private currentUserId: string | null = null;
  private authUnsubscribe: (() => void) | null = null;

  constructor() {
    // Listen to auth changes to sync L3 cache
    this.authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        this.currentUserId = user.uid;
        this.syncL3Cache(user.uid);
      } else {
        this.currentUserId = null;
        if (this.unsubscribeL3) {
          this.unsubscribeL3();
          this.unsubscribeL3 = null;
        }
        this.l3Cache.clear();
      }
    });
  }

  /**
   * Cleans up listeners and clears local caches.
   * Should be called when the system is no longer needed.
   */
  public destroy() {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }
    if (this.unsubscribeL3) {
      this.unsubscribeL3();
      this.unsubscribeL3 = null;
    }
    this.l1Cache.clear();
    this.l3Cache.clear();
  }

  /**
   * Synchronizes the L3 cache with Firestore for the given user.
   * @param userId The ID of the authenticated user.
   */
  private syncL3Cache(userId: string) {
    if (this.unsubscribeL3) {
      this.unsubscribeL3();
    }
    
    const q = query(collection(db, 'caches'), where('userId', '==', userId));
    this.unsubscribeL3 = onSnapshot(q, (snapshot) => {
      this.l3Cache.clear();
      snapshot.forEach(doc => {
        const data = doc.data();
        this.l3Cache.set(data.query.toLowerCase().trim(), {
          id: doc.id,
          query: data.query,
          response: data.response
        });
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'caches');
    });
  }

  /**
   * Retrieves a value from the L2 (LocalStorage) cache.
   */
  private getL2(key: string): string | null {
    try {
      return localStorage.getItem(`l2_${key}`);
    } catch {
      return null;
    }
  }

  /**
   * Sets a value in the L2 (LocalStorage) cache.
   */
  private setL2(key: string, value: string) {
    try {
      localStorage.setItem(`l2_${key}`, value);
    } catch (e) {
      console.warn('LocalStorage quota exceeded or unavailable');
    }
  }

  /**
   * Retrieves a value from the L3 (Semantic) cache.
   * Uses Jaccard similarity to find semantically similar queries.
   * @param queryText The user's prompt.
   * @param threshold The similarity threshold (0 to 1).
   */
  private getL3(queryText: string, threshold: number = 0.85): string | null {
    const normalized = queryText.toLowerCase().trim();
    
    // First check exact match in L3
    if (this.l3Cache.has(normalized)) {
      return this.l3Cache.get(normalized)!.response;
    }

    // Then check semantic similarity
    for (const [cachedQuery, data] of this.l3Cache.entries()) {
      const similarity = this.calculateSimilarity(normalized, cachedQuery);
      if (similarity >= threshold) {
        return data.response;
      }
    }
    
    return null;
  }

  /**
   * Saves a query and its response to the L3 (Firestore) cache.
   * Truncates data to respect Firestore document size limits.
   */
  private async setL3(queryText: string, value: string) {
    if (!this.currentUserId) return;
    
    const normalized = queryText.toLowerCase().trim();
    if (this.l3Cache.has(normalized)) return; // Already exists
    
    try {
      const newCacheRef = doc(collection(db, 'caches'));
      const truncatedResponse = value.length > 99000 ? value.substring(0, 99000) + '... [Truncated]' : value;
      const truncatedQuery = queryText.length > 9000 ? queryText.substring(0, 9000) + '... [Truncated]' : queryText;
      
      await setDoc(newCacheRef, {
        id: newCacheRef.id,
        userId: this.currentUserId,
        query: truncatedQuery,
        response: truncatedResponse,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'caches');
    }
  }

  /**
   * Calculates the Jaccard similarity between two strings.
   */
  private calculateSimilarity(s1: string, s2: string): number {
    const w1 = new Set(s1.split(/\s+/));
    const w2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...w1].filter(x => w2.has(x)));
    const union = new Set([...w1, ...w2]);
    return intersection.size / union.size;
  }

  /**
   * Queries the memory system for a prompt.
   * Checks caches in order: L1 -> L2 -> L3 -> L4.
   * 
   * @param messages The user's input messages (context).
   * @param executeL4 A function to execute the LLM if no cache hits.
   * @param useSemanticCache Whether to use the L3 semantic cache.
   * @param similarityThreshold The threshold for semantic matching.
   * @param onChunk Optional callback for streaming responses.
   * @returns A Promise resolving to the MemoryResult.
   */
  async query(
    messages: Message[], 
    executeL4: (msgs: Message[], onChunk?: (chunk: string) => void) => Promise<string>, 
    useSemanticCache: boolean = true,
    similarityThreshold: number = 0.85,
    onChunk?: (chunk: string) => void
  ): Promise<MemoryResult> {
    
    // Extract the latest user prompt
    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage?.content || "";
    
    // Create a unique key for the entire conversation context
    const contextKey = JSON.stringify(messages.map(m => ({ role: m.role, content: m.content })));

    // 1. Check L1 (Exact match on full context)
    if (this.l1Cache.has(contextKey)) {
      const cached = this.l1Cache.get(contextKey)!;
      if (onChunk) onChunk(cached);
      return { source: 'L1 (RAM)', response: cached };
    }
    
    // 2. Check L2 (Exact match on full context)
    const l2 = this.getL2(contextKey);
    if (l2) {
      this.l1Cache.set(contextKey, l2); // Promote to L1
      if (onChunk) onChunk(l2);
      return { source: 'L2 (Disk)', response: l2 };
    }

    // 3. Check L3 (Semantic match on the last prompt, ONLY if it's a single-turn conversation)
    // Semantic caching is risky for multi-turn as context matters.
    const isSingleTurn = messages.filter(m => m.role === 'user').length === 1;
    if (useSemanticCache && isSingleTurn) {
      const l3 = this.getL3(prompt, similarityThreshold);
      if (l3) {
        this.l1Cache.set(contextKey, l3); // Promote
        this.setL2(contextKey, l3);
        if (onChunk) onChunk(l3);
        return { source: 'L3 (Semantic)', response: l3 };
      }
    }

    // 4. Execute L4 (Compute)
    const response = await executeL4(messages, onChunk);
    
    // Save to all caches
    this.l1Cache.set(contextKey, response);
    this.setL2(contextKey, response);
    
    // Only save to L3 semantic cache if it's a single-turn query
    if (useSemanticCache && isSingleTurn) {
      // Don't await setL3 so it doesn't block returning the response
      this.setL3(prompt, response).catch(console.error);
    }

    return { source: 'L4 (Compute)', response };
  }

  /**
   * Clears all caches (L1, L2, and L3).
   * Removes data from RAM, LocalStorage, and Firestore.
   */
  async clearCache() {
    this.l1Cache.clear();
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('l2_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Clear L3 from Firestore
    if (this.currentUserId) {
      try {
        const { getDocs, deleteDoc, collection, query, where } = await import('firebase/firestore');
        const q = query(collection(db, 'caches'), where('userId', '==', this.currentUserId));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        this.l3Cache.clear();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'caches');
      }
    }
  }
}

export const memorySystem = new MemorySystem();
