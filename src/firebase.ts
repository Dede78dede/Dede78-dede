import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Fail Fast: Check if essential configuration is present
if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("CRITICAL ERROR: Firebase configuration is missing or incomplete. Please check firebase-applet-config.json");
  throw new Error("Firebase configuration is missing or incomplete.");
}

// Initialize Firebase SDK
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
