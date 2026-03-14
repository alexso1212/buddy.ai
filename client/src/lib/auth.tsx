import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: string;
  orgId: number | null;
  avatarUrl: string | null;
  orgName?: string;
  orgType?: string;
  onboardingCompleted?: boolean;
  isSuperAdmin?: boolean;
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
  switchOrg: (orgId: number) => Promise<void>;
  refreshAuth: () => Promise<AuthUser | null>;
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
  switchOrg: async () => {},
  refreshAuth: async () => null,
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
          if (data.token) {
            localStorage.setItem('buddy_token', data.token);
          }
        } else if (res.status === 401) {
          localStorage.removeItem('buddy_token');
          localStorage.removeItem('buddy_user');
        } else {
          const cached = localStorage.getItem('buddy_user');
          if (cached) {
            try { setUser(JSON.parse(cached)); } catch {}
          }
        }
      })
      .catch(() => {
        const cached = localStorage.getItem('buddy_user');
        if (cached) {
          try { setUser(JSON.parse(cached)); } catch {}
        }
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
      let errorMsg = text;
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || text;
      } catch {}
      throw new Error(errorMsg);
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
    if (data.token) {
      localStorage.setItem('buddy_token', data.token);
    }
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
      let errorMsg = text;
      try {
        const json = JSON.parse(text);
        errorMsg = json.error || json.message || text;
      } catch {}
      throw new Error(errorMsg);
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

  const refreshAuth = useCallback(async (): Promise<AuthUser | null> => {
    const token = localStorage.getItem('buddy_token');
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const u = data.user || data;
      setUser(u);
      localStorage.setItem('buddy_user', JSON.stringify(u));
      if (data.token) {
        localStorage.setItem('buddy_token', data.token);
      }
      return u;
    } catch {
      return null;
    }
  }, []);

  const switchOrg = useCallback(async (orgId: number) => {
    const token = localStorage.getItem('buddy_token');
    if (!token) throw new Error('Not authenticated');

    const res = await fetch('/api/user/switch-org', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orgId }),
    });

    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(text);
    }

    const data = await res.json();
    const newToken = data.data.token;
    const u = data.data.user;
    localStorage.setItem('buddy_token', newToken);
    localStorage.setItem('buddy_user', JSON.stringify(u));
    setUser(u);

    const { queryClient } = await import('./queryClient');
    queryClient.invalidateQueries();
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
        switchOrg,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
