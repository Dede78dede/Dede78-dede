import { createContext, useContext, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { useAuthLogic } from '../features/auth/hooks/useAuthLogic';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider manages the global authentication state using Firebase Auth.
 * It also ensures that a corresponding user document exists in Firestore
 * upon successful login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, loading, login, logout } = useAuthLogic();

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {loading ? (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-400 font-medium">Verifica autenticazione in corso...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access the authentication context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
