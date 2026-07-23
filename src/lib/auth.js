'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        loadUserProfile(firebaseUser)
          .then((profile) => {
            if (profile) setUserProfile(profile);
          })
          .catch((err) => console.warn('User profile warning:', err?.message || err));
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isDevUser = (email) => {
    if (!email) return false;
    const lower = email.toLowerCase();
    return lower.includes('natan') || lower.includes('dev') || lower.includes('admin') || lower === 'natansilaban25@gmail.com';
  };

  const loadUserProfile = async (firebaseUser) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      const isDev = isDevUser(firebaseUser.email);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (isDev && data.tier !== 'premium') {
          await setDoc(userRef, { ...data, tier: 'premium' }, { merge: true });
          return { ...data, tier: 'premium' };
        }
        return data;
      } else {
        // Create new user profile
        const newProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          tier: isDev ? 'premium' : 'free',
          dailyMessageCount: 0,
          dailyResetDate: new Date().toDateString(),
          totalMessages: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, newProfile);
        return newProfile;
      }
    } catch (error) {
      console.warn('Load user profile warning:', error?.message || error);
      return null;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { setPersistence, browserLocalPersistence } = await import('firebase/auth');
      await setPersistence(auth, browserLocalPersistence);
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      const result = await signInWithPopup(auth, provider);
      return { success: true, user: result.user };
    } catch (error) {
      console.warn('Sign in error:', error);
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  };

  const isPremium = () => {
    if (isDevUser(user?.email || userProfile?.email)) return true;
    return userProfile?.tier === 'premium';
  };

  const canSendMessage = () => {
    if (isDevUser(user?.email || userProfile?.email)) return true;
    if (!userProfile) return true; // Allow guest/initial loading test
    if (isPremium()) return true;

    const today = new Date().toDateString();
    if (userProfile.dailyResetDate !== today) return true;
    return (userProfile.dailyMessageCount || 0) < 50;
  };

  const getRemainingMessages = () => {
    if (isDevUser(user?.email || userProfile?.email)) return Infinity;
    if (!userProfile) return 50;
    if (isPremium()) return Infinity;

    const today = new Date().toDateString();
    if (userProfile.dailyResetDate !== today) return 50;
    return Math.max(0, 50 - (userProfile.dailyMessageCount || 0));
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      signInWithGoogle,
      signOut,
      isPremium,
      canSendMessage,
      getRemainingMessages,
      setUserProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
