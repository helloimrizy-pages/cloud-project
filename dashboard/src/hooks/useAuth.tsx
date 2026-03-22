import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import * as auth from '../lib/auth';

interface AuthUser {
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.getSession().then(session => {
      if (session) {
        const email = auth.getCurrentUserEmail();
        setUser(email ? { email } : null);
      }
      setLoading(false);
    });
  }, []);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    await auth.signIn(email, password);
    setUser({ email });
  }, []);

  const handleSignUp = useCallback(async (email: string, password: string) => {
    await auth.signUp(email, password);
  }, []);

  const handleConfirmSignUp = useCallback(async (email: string, code: string) => {
    await auth.confirmSignUp(email, code);
  }, []);

  const handleSignOut = useCallback(() => {
    auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext value={{
      user,
      loading,
      signIn: handleSignIn,
      signUp: handleSignUp,
      confirmSignUp: handleConfirmSignUp,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
