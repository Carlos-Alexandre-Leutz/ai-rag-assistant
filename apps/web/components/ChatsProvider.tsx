'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ChatSummary,
  Usage,
  createGuestSession,
  errorMessage,
  getUsage,
  isUnauthorized,
  listChats,
} from '@/lib/chats';

type AuthState = 'loading' | 'user' | 'unavailable';
type ChatsStatus = 'loading' | 'ready' | 'error';

type ChatsContextValue = {
  auth: AuthState;
  authError: string;
  userName: string;
  usage: Usage | null;
  chats: ChatSummary[];
  chatsStatus: ChatsStatus;
  refreshChats: () => Promise<void>;
  logout: () => void;
  leaveTo: (path: string) => void;
  handleExpiredSession: () => void;
};

const POLL_INTERVAL_MS = 3000;

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

const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user_name');
  localStorage.removeItem('is_guest');
};

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const started = useRef(false);
  const [auth, setAuth] = useState<AuthState>('loading');
  const [authError, setAuthError] = useState('');
  const [userName, setUserName] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsStatus, setChatsStatus] = useState<ChatsStatus>('loading');

  const handleExpiredSession = useCallback(() => {
    const wasGuest = localStorage.getItem('is_guest') === '1';
    clearSession();
    if (wasGuest) window.location.assign('/dashboard');
    else router.replace('/login');
  }, [router]);

  const refreshChats = useCallback(async () => {
    try {
      const [list, currentUsage] = await Promise.all([listChats(), getUsage()]);
      setChats(list);
      setUsage(currentUsage);
      setChatsStatus('ready');
    } catch (error) {
      if (isUnauthorized(error)) return handleExpiredSession();
      setChatsStatus((status) => (status === 'ready' ? status : 'error'));
    }
  }, [handleExpiredSession]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const start = async () => {
      if (!readToken()) {
        try {
          const session = await createGuestSession();
          localStorage.setItem('token', session.access_token);
          localStorage.setItem('user_name', session.name);
          localStorage.setItem('is_guest', '1');
        } catch (error) {
          setAuthError(errorMessage(error, 'Could not start a guest session.'));
          setAuth('unavailable');
          return;
        }
      }
      setUserName(localStorage.getItem('user_name') || '');
      setAuth('user');
      refreshChats();
    };

    start();
  }, [refreshChats]);

  const hasProcessing = chats.some((c) => c.document?.status === 'PROCESSING');
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(refreshChats, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasProcessing, refreshChats]);

  const leaveTo = (path: string) => {
    clearSession();
    router.replace(path);
  };

  return (
    <ChatsContext.Provider
      value={{
        auth,
        authError,
        userName,
        usage,
        chats,
        chatsStatus,
        refreshChats,
        logout: () => leaveTo('/login'),
        leaveTo,
        handleExpiredSession,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
}
