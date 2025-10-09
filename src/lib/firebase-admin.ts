import admin from 'firebase-admin';
const serviceAccount = require('./service-account.json');

const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const app = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucketName,
  });

  const firestore = admin.firestore();
  const storage = admin.storage();

console.log("Using bucket:", storage.bucket().name);
export { admin, firestore, storage };
