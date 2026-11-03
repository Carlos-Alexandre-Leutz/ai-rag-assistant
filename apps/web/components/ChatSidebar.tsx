'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useChats } from '@/components/ChatsProvider';
import { createChatFromFile, deleteChat, errorMessage, isUnauthorized } from '@/lib/chats';

export default function ChatSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const params = useParams<{ chatId?: string }>();
  const { chats, userName, refreshChats, logout, handleExpiredSession } = useChats();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const chat = await createChatFromFile(file);
      await refreshChats();
      onClose();
      router.push(`/dashboard/${chat.id}`);
    } catch (err) {
      if (isUnauthorized(err)) return handleExpiredSession();
      setError(errorMessage(err, 'Could not process the document.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete the chat "${title}" and its document?`)) return;
    try {
      await deleteChat(id);
      await refreshChats();
      if (params.chatId === id) router.push('/dashboard');
    } catch (err) {
      if (isUnauthorized(err)) return handleExpiredSession();
      setError(errorMessage(err, 'Could not delete the chat.'));
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 z-40 lg:hidden transition-opacity duration-300 ${
          open ? 'opacity-100 block' : 'opacity-0 hidden'
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] lg:translate-x-0 lg:static flex flex-col transition-transform duration-300 ease-in-out bg-[#131b2e] border-r border-[#5c3f40] p-4 gap-4 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <Link href="/dashboard" className="text-2xl font-bold text-[#ffb3b6]">
            Vermilion
          </Link>
          <button className="lg:hidden text-[#e5bdbe] hover:text-[#dae2fd]" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <input
          type="file"
          accept="application/pdf,.pdf"
          ref={fileInputRef}
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 bg-[#e11d48] text-[#fffaf9] rounded-lg font-bold py-3 px-4 transition-all duration-200 hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
        >
          <span className="material-symbols-outlined">{uploading ? 'hourglass_top' : 'add'}</span>
          <span className="font-mono text-xs">{uploading ? 'Processing PDF...' : 'New Chat (PDF)'}</span>
        </button>

        {error && <p className="text-xs text-[#ffb4ab]">{error}</p>}

        <nav className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
          {chats.length === 0 && (
            <p className="text-xs text-[#e5bdbe]/60 px-2 py-4">
              No chats yet. Upload a PDF to start one.
            </p>
          )}
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center gap-2 rounded-lg pr-1 transition-colors ${
                params.chatId === chat.id ? 'bg-[#2d3449]' : 'hover:bg-[#171f33]'
              }`}
            >
              <Link
                href={`/dashboard/${chat.id}`}
                onClick={onClose}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 min-w-0"
              >
                <span className="material-symbols-outlined text-[#ffb3b6] text-[18px]">description</span>
                <span className="truncate text-sm text-[#dae2fd]">{chat.title}</span>
              </Link>
              <button
                onClick={() => handleDelete(chat.id, chat.title)}
                title="Delete chat"
                className="opacity-0 group-hover:opacity-100 p-1.5 text-[#e5bdbe] hover:text-[#ffb4ab] transition"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#5c3f40] pt-3 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold text-[#dae2fd]">{userName || 'My account'}</span>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 text-[#e5bdbe] hover:text-[#dae2fd] transition"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
