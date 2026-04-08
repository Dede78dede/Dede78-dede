import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app;
if (!getApps().length) {
  app = initializeApp({
    credential: applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
} else {
  app = getApps()[0];
}

export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
