
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const bucketName = 'm-health-jxug7.firebasestorage.app';

let app;

if (!admin.apps.length) {
  let credential;
  const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

  if (process.env.NODE_ENV !== 'production' && fs.existsSync(serviceAccountPath)) {
    // Use local service account file for development if it exists
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
    console.log('Using local service-account.json for Firebase Admin SDK in development.');
  } else {
    // Use application default credentials in production or if local file is not found
    credential = admin.credential.applicationDefault();
    if (process.env.NODE_ENV === 'production') {
        console.log('Using application default credentials for Firebase Admin SDK in production.');
    } else {
        console.log('Local service-account.json not found. Falling back to application default credentials.');
    }
  }

  app = admin.initializeApp({
    credential,
    storageBucket: bucketName,
  });
} else {
  app = admin.app();
}

const firestore = admin.firestore();
const storage = admin.storage();

console.log('Using bucket:', storage.bucket().name);
export { admin, firestore, storage };
