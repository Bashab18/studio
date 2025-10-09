import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'm-health-jxug7',
  appId: '1:284239863057:web:efb385e0aeb95c2f2480b0',
  storageBucket: 'm-health-jxug7.firebasestorage.app',
  apiKey: 'AIzaSyBOg1Bfwx_Gjbx7DO4i54KjAJKKq-dZ5lg',
  authDomain: 'm-health-jxug7.firebaseapp.com',
  messagingSenderId: '284239863057',
  measurementId: 'G-XXXXXXXXXX'
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

try {
  enableIndexedDbPersistence(db);
} catch (error: any) {
  if (error.code == 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled
    // in one tab at a time.
    console.warn('Firestore persistence failed: multiple tabs open.');
  } else if (error.code == 'unimplemented') {
    // The current browser does not support all of the
    // features required to enable persistence
    console.warn('Firestore persistence is not available in this browser.');
  }
}


export { app, auth, db };
