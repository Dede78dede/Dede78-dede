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

// Configure Google Provider with additional scopes for Google services
export const googleProvider = new GoogleAuthProvider();
// Add scopes for future integrations (Drive, Docs, GCP, etc.)
// Note: We start with basic profile/email. We can request more scopes incrementally later using auth.currentUser.linkWithPopup()
googleProvider.addScope('profile');
googleProvider.addScope('email');
