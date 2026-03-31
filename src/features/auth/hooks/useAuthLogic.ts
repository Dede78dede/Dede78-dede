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

    const unsubscribeToken = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setApiToken(token);
        } catch (error) {
          console.error('Failed to get Firebase ID token:', error);
          setApiToken(null);
        }
      } else {
        setApiToken(null);
      }
    });

    return () => {
      unsubscribe();
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
