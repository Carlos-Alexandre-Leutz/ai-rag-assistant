'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChats } from '@/components/ChatsProvider';
import MarkdownMessage from '@/components/MarkdownMessage';
import {
  ChatMessage,
  ChatSummary,
  errorMessage,
  getChat,
  getMessages,
  isUnauthorized,
  StreamHandlers,
  streamAnswer,
  streamMessage,
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
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [auth, chatId, reloadKey, router, handleExpiredSession]);

  // Document still processing: poll until it is READY or FAILED.
  const documentStatus = chat?.document?.status;
  useEffect(() => {
    if (documentStatus !== 'PROCESSING') return;
    const timer = setInterval(() => {
      getChat(chatId)
        .then(setChat)
        .catch((err) => isUnauthorized(err) && handleExpiredSession());
    }, 3000);
    return () => clearInterval(timer);
  }, [documentStatus, chatId, handleExpiredSession]);

  useEffect(() => {
    if (chatAreaRef.current) chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
  }, [messages, sending]);

  const runStream = async (
    start: (handlers: StreamHandlers) => ReturnType<typeof streamMessage>,
    options: { optimistic?: ChatMessage; dropLastAnswer?: boolean } = {},
  ) => {
    if (sending || documentStatus !== 'READY') return;
    const { optimistic, dropLastAnswer } = options;

    const placeholder: ChatMessage = {
      id: `tmp-ai-${Date.now()}`,
      role: 'AI',
      content: '',
      createdAt: new Date().toISOString(),
    };
    const updatePlaceholder = (change: (m: ChatMessage) => ChatMessage) =>
      setMessages((prev) => prev.map((m) => (m.id === placeholder.id ? change(m) : m)));

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      const base = dropLastAnswer && last?.role === 'AI' ? prev.slice(0, -1) : prev;
      return [...base, ...(optimistic ? [optimistic] : []), placeholder];
    });
    setSending(true);
    setError('');

    try {
      const { userMessage, aiMessage } = await start({
        onSources: (sources) => updatePlaceholder((m) => ({ ...m, sources })),
        onDelta: (piece) => updatePlaceholder((m) => ({ ...m, content: m.content + piece })),
      });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic?.id && m.id !== placeholder.id),
        ...(optimistic ? [userMessage] : []),
        aiMessage,
      ]);
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

  const handleSend = () => {
    const content = text.trim();
    if (!content || sending) return;

    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    runStream((handlers) => streamMessage(chatId, content, handlers), {
      optimistic: {
        id: `tmp-${Date.now()}`,
        role: 'USER',
        content,
        createdAt: new Date().toISOString(),
      },
    });
  };

  const handleRetry = () => runStream((handlers) => streamAnswer(chatId, handlers));

  const handleRegenerate = () =>
    runStream((handlers) => streamAnswer(chatId, handlers), { dropLastAnswer: true });

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

  const lastMessage = messages[messages.length - 1];
  const waitingFirstToken = sending && lastMessage?.role === 'AI' && lastMessage.content === '';

  if (auth !== 'user') return null;

  return (
    <>
      <header className="flex items-center gap-3 px-4 pl-14 lg:pl-4 h-16 w-full border-b border-[#5c3f40] bg-[#0b1326] z-20">
        <span className="material-symbols-outlined text-[#ffb3b6]">description</span>
        <h1 className="text-lg font-bold truncate">{chat?.title ?? '...'}</h1>
      </header>

      {documentStatus === 'PROCESSING' && (
        <div className="px-4 py-3 text-sm text-[#e5bdbe] bg-[#171f33] border-b border-[#5c3f40] animate-pulse">
          Processing your document... You can ask questions as soon as it is ready.
        </div>
      )}
      {documentStatus === 'FAILED' && (
        <div className="px-4 py-3 text-sm text-[#ffb4ab] bg-[#171f33] border-b border-[#5c3f40]">
          Could not process this document: {chat?.document?.failureReason || 'Unknown error.'} You
          can delete this chat from the sidebar.
        </div>
      )}

      <div ref={chatAreaRef} className="flex-1 overflow-y-auto p-4 pt-8 pb-40">
        <div className="max-w-[800px] mx-auto space-y-8">
          {loadingChat && (
            <p className="text-center text-[#e5bdbe]/70 animate-pulse">Loading messages...</p>
          )}

          {!loadingChat && !chat && error && (
            <div className="text-center space-y-3">
              <p className="text-[#ffb4ab]">{error}</p>
              <button
                onClick={() => setReloadKey((key) => key + 1)}
                className="text-sm text-[#ffb3b6] underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}

          {!loadingChat && messages.length === 0 && !error && documentStatus === 'READY' && (
            <p className="text-center text-[#e5bdbe]/70">
              Ask anything about <b>{chat?.title}</b>.
            </p>
          )}

          {messages
            .filter((m) => m.role !== 'AI' || m.content !== '')
            .map((m) => (
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
                {m.role === 'AI' ? (
                  <MarkdownMessage content={m.content} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
              {m.role === 'AI' && m.sources && m.sources.length > 0 && (
                <details className="max-w-[85%] w-full text-xs text-[#e5bdbe]">
                  <summary className="cursor-pointer select-none font-mono hover:text-[#dae2fd]">
                    Sources ({m.sources.length})
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {m.sources.map((source, index) => (
                      <li
                        key={index}
                        className="rounded-lg bg-[#131b2e] border border-[#5c3f40] px-3 py-2"
                      >
                        <div className="font-mono text-[#ffb3b6] mb-1">
                          [{index + 1}] {source.filename}
                          {source.page ? ` · page ${source.page}` : ''}
                        </div>
                        <p className="text-[#dae2fd]/80 whitespace-pre-wrap">
                          {source.excerpt}
                          {source.excerpt.length >= 300 ? '…' : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[#e5bdbe] opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity">
                  {formatTime(m.createdAt)}
                </span>
                {m.role === 'AI' && m.id === lastMessage?.id && !sending && (
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-1 text-xs text-[#e5bdbe] hover:text-[#dae2fd] transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">refresh</span>
                    Regenerate
                  </button>
                )}
              </div>
            </div>
          ))}

          {lastMessage?.role === 'USER' && !sending && documentStatus === 'READY' && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 text-sm text-[#ffb3b6] hover:brightness-125 transition"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              Try again
            </button>
          )}

          {waitingFirstToken && (
            <div className="bg-[#171f33] w-fit px-4 py-3 rounded-2xl rounded-tl-none border border-[#5c3f40] flex gap-1.5 items-center h-10">
              <span className="w-1.5 h-1.5 bg-[#5c3f40] rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-[#5c3f40] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-[#5c3f40] rounded-full animate-bounce" />
            </div>
          )}

          {error && chat && <p className="text-center text-[#ffb4ab] text-sm">{error}</p>}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#0b1326] via-[#0b1326] to-transparent pointer-events-none">
        <div className="max-w-[800px] mx-auto pointer-events-auto bg-[#222a3d] border border-[#5c3f40] rounded-[24px] p-2 shadow-xl backdrop-blur-md">
          <div className="flex items-end gap-2 p-1">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[#dae2fd] placeholder-[#e5bdbe]/60 py-3 px-3 text-base sm:text-sm resize-none max-h-48"
              placeholder={
                documentStatus === 'READY'
                  ? 'Ask a question about this document...'
                  : 'Waiting for the document to be ready...'
              }
              disabled={documentStatus !== 'READY'}
              rows={1}
            />
            <button
              className="p-3 bg-[#ffb3b6] text-[#68001a] rounded-full hover:brightness-110 active:scale-90 transition-all flex-shrink-0 shadow-lg disabled:opacity-60"
              title="Send message"
              onClick={handleSend}
              disabled={sending || !text.trim() || documentStatus !== 'READY'}
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
