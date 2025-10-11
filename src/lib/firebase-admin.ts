import admin from 'firebase-admin';

// In a managed environment like Firebase App Hosting, the SDK will automatically
// discover the correct credentials to use. There is no need to manage a
// service account key file manually.
const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

const storage = app.storage();
const firestore = app.firestore();

export { app, storage, firestore };
