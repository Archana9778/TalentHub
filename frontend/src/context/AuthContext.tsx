import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
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
    confirmPassword?: string;
    name: string;
    role: string;
    companyName?: string;
    title?: string;
    location?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (payload: { token: string; newPassword: string; confirmPassword?: string }) => Promise<void>;
  updateCurrentUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Attempt to fetch current user (works via HttpOnly cookie or in-memory token)
        const { user: fetchedUser } = await api.getMe();
        setUser(fetchedUser);
      } catch {
        // No active or valid session
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
    confirmPassword?: string;
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

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
    } catch {
      // Continue client cleanup even if network fails
    } finally {
      clearToken();
      setTokenState(null);
      setUser(null);
    }
  };

  const forgotPassword = async (email: string): Promise<void> => {
    await api.forgotPassword(email);
  };

  const resetPassword = async (payload: {
    token: string;
    newPassword: string;
    confirmPassword?: string;
  }): Promise<void> => {
    await api.resetPassword(payload);
  };

  const updateCurrentUser = (updates: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updates });
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
        forgotPassword,
        resetPassword,
        updateCurrentUser,
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
