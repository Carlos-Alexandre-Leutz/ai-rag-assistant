'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChats } from '@/components/ChatsProvider';
import {
  ChatMessage,
  ChatSummary,
  errorMessage,
  getChat,
  getMessages,
  isUnauthorized,
  sendMessage,
} from '@/lib/chats';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const router = useRouter();
  const { auth, refreshChats, handleExpiredSession } = useChats();

  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loadingChat, setLoadingChat] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const chatAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (auth === 'guest') router.replace('/login');
  }, [auth, router]);

  useEffect(() => {
    if (auth !== 'user') return;
    let cancelled = false;
    setLoadingChat(true);
    setError('');
    setMessages([]);

    Promise.all([getChat(chatId), getMessages(chatId)])
      .then(([c, m]) => {
        if (cancelled) return;
        setChat(c);
        setMessages(m);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthorized(err)) return handleExpiredSession();
        if (err?.response?.status === 404) return router.replace('/dashboard');
        setError(errorMessage(err, 'Could not load this chat.'));
      })
      .finally(() => !cancelled && setLoadingChat(false));

    return () => {
      cancelled = true;
    };
  }, [auth, chatId, router, handleExpiredSession]);

  useEffect(() => {
    if (chatAreaRef.current) chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
  }, [messages, sending]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);
    setError('');

    try {
      const { userMessage, aiMessage } = await sendMessage(chatId, content);
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), userMessage, aiMessage]);
      refreshChats();
    } catch (err) {
      if (isUnauthorized(err)) return handleExpiredSession();
      // The question was already saved by the BFF; reload so the UI matches the server.
      setError(errorMessage(err, 'Sorry, I encountered an error while processing your request.'));
      getMessages(chatId).then(setMessages).catch(() => undefined);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  if (auth !== 'user') return null;

  return (
    <>
      <header className="flex items-center gap-3 px-4 pl-14 lg:pl-4 h-16 w-full border-b border-[#5c3f40] bg-[#0b1326] z-20">
        <span className="material-symbols-outlined text-[#ffb3b6]">description</span>
        <h1 className="text-lg font-bold truncate">{chat?.title ?? '...'}</h1>
      </header>

      <div ref={chatAreaRef} className="flex-1 overflow-y-auto p-4 pt-8 pb-40">
        <div className="max-w-[800px] mx-auto space-y-8">
          {!loadingChat && messages.length === 0 && !error && (
            <p className="text-center text-[#e5bdbe]/70">
              Ask anything about <b>{chat?.title}</b>.
            </p>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-2 group ${m.role === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] px-5 py-4 rounded-2xl ${
                  m.role === 'USER'
                    ? 'bg-[#e11d48] text-[#fffaf9] rounded-tr-none'
                    : 'bg-[#171f33] text-[#dae2fd] rounded-tl-none border border-[#5c3f40]'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </div>
              <span className="font-mono text-xs text-[#e5bdbe] opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTime(m.createdAt)}
              </span>
            </div>
          ))}

          {sending && (
            <div className="bg-[#171f33] w-fit px-4 py-3 rounded-2xl rounded-tl-none border border-[#5c3f40] flex gap-1.5 items-center h-10">
              <span className="w-1.5 h-1.5 bg-[#5c3f40] rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-[#5c3f40] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-[#5c3f40] rounded-full animate-bounce" />
            </div>
          )}

          {error && <p className="text-center text-[#ffb4ab] text-sm">{error}</p>}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#0b1326] via-[#0b1326] to-transparent pointer-events-none">
        <div className="max-w-[800px] mx-auto pointer-events-auto bg-[#222a3d] border border-[#5c3f40] rounded-[24px] p-2 shadow-xl backdrop-blur-md">
          <div className="flex items-end gap-2 p-1">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[#dae2fd] placeholder-[#e5bdbe]/60 py-3 px-3 text-sm resize-none max-h-48"
              placeholder="Ask a question about this document..."
              rows={1}
            />
            <button
              className="p-3 bg-[#ffb3b6] text-[#68001a] rounded-full hover:brightness-110 active:scale-90 transition-all flex-shrink-0 shadow-lg disabled:opacity-60"
              title="Send message"
              onClick={handleSend}
              disabled={sending || !text.trim()}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                send
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
