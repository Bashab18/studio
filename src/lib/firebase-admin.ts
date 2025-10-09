import admin from 'firebase-admin';

// Correctly initialize the Firebase Admin SDK
// This ensures that server-side operations (like in Genkit flows)
// have the necessary permissions.
const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      storageBucket: 'm-health-jxug7.firebasestorage.app',
  });

const storage = app.storage();

export { app, storage };
