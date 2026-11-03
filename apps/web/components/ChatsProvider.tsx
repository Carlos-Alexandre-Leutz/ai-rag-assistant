'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatSummary, listChats, isUnauthorized } from '@/lib/chats';

type AuthState = 'loading' | 'guest' | 'user';

type ChatsContextValue = {
  auth: AuthState;
  userName: string;
  chats: ChatSummary[];
  refreshChats: () => Promise<void>;
  logout: () => void;
  // Clears the session and sends the user to /login when a request got a 401.
  handleExpiredSession: () => void;
};

const ChatsContext = createContext<ChatsContextValue | null>(null);

export const useChats = () => {
  const ctx = useContext(ChatsContext);
  if (!ctx) throw new Error('useChats must be used inside <ChatsProvider>');
  return ctx;
};

const readToken = () => {
  const token = localStorage.getItem('token');
  return token && token !== 'undefined' && token !== 'null' ? token : null;
};

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>('loading');
  const [userName, setUserName] = useState('');
  const [chats, setChats] = useState<ChatSummary[]>([]);

  const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_name');
  };

  const handleExpiredSession = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

  const refreshChats = useCallback(async () => {
    try {
      setChats(await listChats());
    } catch (error) {
      if (isUnauthorized(error)) handleExpiredSession();
    }
  }, [handleExpiredSession]);

  useEffect(() => {
    if (readToken()) {
      setUserName(localStorage.getItem('user_name') || '');
      setAuth('user');
      refreshChats();
    } else {
      setAuth('guest');
    }
  }, [refreshChats]);

  const logout = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <ChatsContext.Provider
      value={{ auth, userName, chats, refreshChats, logout, handleExpiredSession }}
    >
      {children}
    </ChatsContext.Provider>
  );
}
