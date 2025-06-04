'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase/client';
import { doc, getDoc, Timestamp, setDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile, Organization } from '@/types';
import { useRouter, usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid'; // For generating organization ID

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  // Add other auth-related functions if needed, e.g., loginWithGoogle
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch user profile from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserProfile(userDocSnap.data() as UserProfile);
        } else {
          // This case might happen if a user is created but profile creation fails or is pending.
          // For MaquilaNet, new users are expected to be created via signup which handles profile creation.
          // If a user exists in Auth but not in Firestore 'users' collection, consider it an incomplete setup.
          // For now, we'll set profile to null and rely on signup/login flow to create it.
          console.warn("User exists in Auth but not in Firestore 'users' collection.");
          // Potentially create a default organization and user profile if it's a brand new user from a generic signup.
          // This logic is in the signup page for now.
          setUserProfile(null); 
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user && !pathname.startsWith('/auth') && pathname !== '/') {
      router.push('/auth/login');
    }
    if (!loading && user && (pathname.startsWith('/auth') || pathname === '/')) {
      router.push('/dashboard');
    }
  }, [user, loading, router, pathname]);


  const logout = async () => {
    setLoading(true);
    try {
      await auth.signOut();
      setUser(null);
      setUserProfile(null);
      router.push('/auth/login');
    } catch (error) {
      console.error("Error signing out: ", error);
      // Handle error appropriately, e.g., show a toast
    } finally {
      setLoading(false);
    }
  };
  
  // Function to create organization and user profile, typically called after signup
  // This is a helper that could be used by signup logic
  const createOrganizationAndUserProfile = async (
    firebaseUser: User,
    organizationName: string,
    role: 'admin' | 'engineer' | 'technician' = 'admin'
  ): Promise<UserProfile> => {
    const organizationId = uuidv4();
    const organizationRef = doc(db, 'organizations', organizationId);
    const newOrganization: Organization = {
      id: organizationId,
      name: organizationName,
      createdAt: serverTimestamp() as Timestamp,
    };
    await setDoc(organizationRef, newOrganization);

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const newUserProfile: UserProfile = {
      id: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unnamed User',
      organizationId: organizationId,
      role: role,
      createdAt: serverTimestamp() as Timestamp,
    };
    await setDoc(userDocRef, newUserProfile);
    setUserProfile(newUserProfile);
    return newUserProfile;
  };


  return (
    <AuthContext.Provider value={{ user, userProfile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
