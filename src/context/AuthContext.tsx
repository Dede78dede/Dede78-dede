import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider manages the global authentication state using Firebase Auth.
 * It also ensures that a corresponding user document exists in Firestore
 * upon successful login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Create or update user document
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            const userData: any = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              role: 'user',
              createdAt: serverTimestamp()
            };
            if (currentUser.displayName) userData.displayName = currentUser.displayName;
            if (currentUser.photoURL) userData.photoURL = currentUser.photoURL;
            
            await setDoc(userRef, userData);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}`);
        }
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Initiates the Google Sign-In flow via a popup.
   */
  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  /**
   * Signs out the current user.
   */
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {loading ? (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-400 font-medium">Verifica autenticazione in corso...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access the authentication context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
