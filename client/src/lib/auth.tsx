import { createContext, useContext } from 'react';

interface AuthContextType {
  currentUserId: number;
}

const AuthContext = createContext<AuthContextType>({ currentUserId: 1 });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{ currentUserId: 1 }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
