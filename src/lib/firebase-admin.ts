import admin from 'firebase-admin';

// Correctly initialize the Firebase Admin SDK
// This ensures that server-side operations (like in Genkit flows)
// have the necessary permissions.
const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'm-health-jxug7.appspot.com',
  });

const storage = app.storage();

export { app, storage };
