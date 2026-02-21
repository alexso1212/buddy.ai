import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { User } from '@shared/schema';
import { apiRequest, queryClient, getQueryFn } from './queryClient';

type SafeUser = Omit<User, 'invite_code'>;

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  login: (inviteCode: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);

  const { data: fetchedUser, isLoading: isMeLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    retry: false,
  });

  useEffect(() => {
    if (fetchedUser) {
      const { invite_code, ...safeUser } = fetchedUser;
      setUser(safeUser);
    } else if (fetchedUser === null) {
      setUser(null);
    }
  }, [fetchedUser]);

  const loginMutation = useMutation({
    mutationFn: async (inviteCode: string) => {
      await apiRequest('POST', '/api/auth/login', { invite_code: inviteCode });
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/auth/logout', {});
      await queryClient.invalidateQueries();
      setUser(null);
    },
  });

  const login = async (inviteCode: string) => {
    await loginMutation.mutateAsync(inviteCode);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isMeLoading || loginMutation.isPending || logoutMutation.isPending,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
