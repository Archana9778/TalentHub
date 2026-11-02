import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api, getToken, setToken, clearToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    email: string;
    password: string;
    name: string;
    role: string;
    companyName?: string;
    title?: string;
    location?: string;
  }) => Promise<User>;
  logout: () => void;
  updateCurrentUser: (updates: Partial<User>) => void;
  switchDemoRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const { user: fetchedUser } = await api.getMe();
        setUser(fetchedUser);
      } catch (err) {
        console.warn('[TalentHub Auth] Failed to restore session from token:', err);
        clearToken();
        setTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await api.login({ email, password });
      setToken(data.token);
      setTokenState(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: {
    email: string;
    password: string;
    name: string;
    role: string;
    companyName?: string;
    title?: string;
    location?: string;
  }): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await api.register(payload);
      setToken(data.token);
      setTokenState(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setUser(null);
  };

  const updateCurrentUser = (updates: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updates });
    }
  };

  const switchDemoRole = async (role: UserRole) => {
    const credentialsMap: Record<UserRole, { email: string; pass: string }> = {
      candidate: { email: 'candidate@talenthub.com', pass: 'password123' },
      recruiter: { email: 'recruiter@techcorp.com', pass: 'password123' },
      admin: { email: 'admin@talenthub.com', pass: 'password123' },
    };

    const target = credentialsMap[role];
    if (target) {
      await login(target.email, target.pass);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateCurrentUser,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

