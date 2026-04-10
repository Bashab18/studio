'use client';

import { useState, useEffect, useContext } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, increment } from 'firebase/firestore';
import { AuthContext } from '@/components/auth-provider';
import { type User } from '@/lib/auth';
import { auth, db } from '@/lib/firebase';

export type UseAuthReturn = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string, role: 'user' | 'admin') => Promise<User>;
  logout: () => void;
  refreshUserProfile: () => Promise<void>;
};

export function useAuth(): UseAuthReturn {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

async function getUserProfile(uid: string): Promise<User | null> {
  const userDocRef = doc(db, 'users', uid);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const userData = userDoc.data();
    // Firestore timestamp needs to be converted
    return {
      id: userDoc.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      loginCount: userData.loginCount,
      createdAt: userData.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
      adminNotes: userData.adminNotes || '',
      profileInfo: userData.profileInfo || '',
    };
  }
  return null;
}

const createUserProfile = async (firebaseUser: FirebaseUser, name: string, role: 'user' | 'admin'): Promise<User> => {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      if (!firebaseUser.email) {
        throw new Error('Firebase user must have an email address');
      }

      // Store Firestore FieldValues for timestamp fields
      const now = new Date().toISOString();
      await setDoc(userDocRef, {
        id: firebaseUser.uid,
        name: name,
        email: firebaseUser.email,
        role: role,
        loginCount: 1,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        adminNotes: '',
        profileInfo: '',
      });

      const createdProfile = await getUserProfile(firebaseUser.uid);
      if (!createdProfile) {
        throw new Error('Failed to create user profile - profile not found after creation');
      }
      return createdProfile;
  }

export function useAuthHook(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserProfile = async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      const userProfile = await getUserProfile(firebaseUser.uid);
      setUser(userProfile);
    }
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await getUserProfile(firebaseUser.uid);
        setUser(userProfile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const firebaseUser = userCredential.user;

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      let userProfile: User;

      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
            loginCount: increment(1),
            lastLogin: serverTimestamp()
        });
        const fetchedProfile = await getUserProfile(firebaseUser.uid);
        if (!fetchedProfile) {
          throw new Error('Failed to fetch user profile after login');
        }
        userProfile = fetchedProfile;
      } else {
         userProfile = await createUserProfile(firebaseUser, firebaseUser.displayName || email.split('@')[0], 'user');
      }

      setUser(userProfile);
      return userProfile;

    } catch (error: unknown) {
        const errorToThrow = error instanceof Error ? error : new Error(String(error));
        const errorCode = (error as any)?.code;

        if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
            throw new Error('Invalid email or password.');
        }
        if (errorCode === 'auth/too-many-requests') {
            throw new Error('Too many login attempts. Please try again later.');
        }
        throw new Error(errorToThrow.message || 'An unknown error occurred during login.');
    }
    finally {
      setLoading(false);
    }
  };

  const signUp = async (name: string, email: string, password: string, role: 'user' | 'admin'): Promise<User> => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update Firebase Auth profile
      await updateProfile(firebaseUser, { displayName: name });

      // Create user profile in Firestore
      const userProfile = await createUserProfile(firebaseUser, name, role);

      setUser(userProfile);
      return userProfile;

    } catch (error: unknown) {
      const errorCode = (error as any)?.code;

      if (errorCode === 'auth/email-already-in-use') {
        throw new Error('This email is already registered. Please sign in or use a different email.');
      }
      if (errorCode === 'auth/weak-password') {
        throw new Error('The password is too weak. Please use at least 6 characters.');
      }
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(errorMsg || 'An unknown error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Logout failed:', errorMsg);
      // Still clear user state even if logout fails
      setUser(null);
      throw new Error(`Logout failed: ${errorMsg}`);
    }
  };

  return { user, loading, login, signUp, logout, refreshUserProfile };
}
