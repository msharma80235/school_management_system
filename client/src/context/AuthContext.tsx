import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import api from '../services/api';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: User | null;
  org: OrgInfo | null;
  token: string | null;
  login: (email: string, password: string, orgSlug: string) => Promise<User>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(() => {
    const stored = localStorage.getItem('org');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    if (token && !user) {
      setLoading(true);
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data.user);
          if (res.data.org) {
            setOrg(res.data.org);
            localStorage.setItem('org', JSON.stringify(res.data.org));
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('org');
          setToken(null);
          setUser(null);
          setOrg(null);
        })
        .finally(() => setLoading(false));
    }
  }, [token]);

  const login = async (email: string, password: string, orgSlug: string): Promise<User> => {
    const res = await api.post('/auth/login', { email, password, org_slug: orgSlug });
    const { token: newToken, user: newUser, org: newOrg } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('org', JSON.stringify(newOrg));
    setToken(newToken);
    setUser(newUser);
    setOrg(newOrg);
    return newUser;
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('org');
    setToken(null);
    setUser(null);
    setOrg(null);
  };

  return (
    <AuthContext.Provider value={{ user, org, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
