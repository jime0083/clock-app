import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  subscribeToAuthState,
  convertToAppUser,
  signOut as authSignOut,
} from '@/services/authService';

type FirebaseUser = FirebaseAuthTypes.User;
import { AppUser, AuthState } from '@/types/auth';

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>;
  setUser: (user: AppUser | null) => void;
}

const initialState: AuthState = {
  user: null,
  firebaseUser: null,
  isLoading: true,
  isAuthenticated: false,
  isInitialized: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const appUser = await convertToAppUser(firebaseUser);
          setState({
            user: appUser,
            firebaseUser,
            isLoading: false,
            isAuthenticated: true,
            isInitialized: true,
          });
        } catch (error) {
          console.error('Error converting user:', error);
          setState({
            user: null,
            firebaseUser: null,
            isLoading: false,
            isAuthenticated: false,
            isInitialized: true,
          });
        }
      } else {
        setState({
          user: null,
          firebaseUser: null,
          isLoading: false,
          isAuthenticated: false,
          isInitialized: true,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await authSignOut();
      setState({
        user: null,
        firebaseUser: null,
        isLoading: false,
        isAuthenticated: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Error signing out:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const setUser = useCallback((user: AppUser | null) => {
    setState(prev => ({
      ...prev,
      user,
      isAuthenticated: !!user,
    }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signOut,
        setUser,
      }}
    >
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
