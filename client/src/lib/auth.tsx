import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: string;
  orgId: number;
  avatarUrl: string | null;
  orgName?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  currentUserId: number;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  currentUserId: 0,
  login: async () => {},
  loginWithToken: async () => {},
  register: async () => {},
  logout: () => {},
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('buddy_token');
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          const u = data.user || data;
          setUser(u);
          localStorage.setItem('buddy_user', JSON.stringify(u));
        } else {
          localStorage.removeItem('buddy_token');
          localStorage.removeItem('buddy_user');
        }
      })
      .catch(() => {
        localStorage.removeItem('buddy_token');
        localStorage.removeItem('buddy_user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(text);
    }

    const data = await res.json();
    const token = data.token;
    const u = data.user;
    localStorage.setItem('buddy_token', token);
    localStorage.setItem('buddy_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const loginWithToken = useCallback(async (token: string) => {
    localStorage.setItem('buddy_token', token);
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      localStorage.removeItem('buddy_token');
      throw new Error('Token verification failed');
    }
    const data = await res.json();
    const u = data.user || data;
    localStorage.setItem('buddy_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });

    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(text);
    }

    const data = await res.json();
    const token = data.token;
    const u = data.user;
    localStorage.setItem('buddy_token', token);
    localStorage.setItem('buddy_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('buddy_token');
    localStorage.removeItem('buddy_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem('buddy_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        currentUserId: user?.id || 0,
        login,
        loginWithToken,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
