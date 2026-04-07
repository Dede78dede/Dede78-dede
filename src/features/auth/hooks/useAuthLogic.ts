import { useState, useEffect } from 'react';
import { onAuthStateChanged, onIdTokenChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../../../firebase';
import { handleFirestoreError, OperationType } from '../../../utils/firestoreErrorHandler';
import { setApiToken } from '../../../utils/api';

export function useAuthLogic() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    // Fallback timeout in case onAuthStateChanged never fires (e.g. Safari iframe storage blocking)
    const fallbackTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("Auth state check timed out. Proceeding as unauthenticated.");
        setLoading(false);
      }
    }, 5000);

    const unsubscribeToken = onIdTokenChanged(auth, async (currentUser) => {
      clearTimeout(fallbackTimeout);
      if (!isMounted) return;

      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setApiToken(token);
          setUser(currentUser);
          
          // Create or update user document in the background
          const userRef = doc(db, 'users', currentUser.uid);
          getDoc(userRef).then(userSnap => {
            if (!userSnap.exists()) {
              const userData: any = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                role: 'user',
                createdAt: serverTimestamp()
              };
              if (currentUser.displayName) userData.displayName = currentUser.displayName;
              if (currentUser.photoURL) userData.photoURL = currentUser.photoURL;
              
              setDoc(userRef, userData).catch(console.error);
            }
          }).catch(console.error);
          
        } catch (error) {
          console.error('Failed to get Firebase ID token:', error);
          setApiToken(null);
          setUser(null);
        }
      } else {
        setApiToken(null);
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      unsubscribeToken();
    };
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return {
    user,
    loading,
    login,
    logout
  };
}
