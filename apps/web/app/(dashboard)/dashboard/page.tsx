'use client';

import GuestChat from '@/components/GuestChat';
import { useChats } from '@/components/ChatsProvider';

export default function DashboardPage() {
  const { auth, chats, chatsStatus } = useChats();

  if (auth !== 'user') return <GuestChat />;

  if (chatsStatus !== 'ready') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className={chatsStatus === 'error' ? 'text-[#ffb4ab]' : 'text-[#e5bdbe]/70 animate-pulse'}>
          {chatsStatus === 'error' ? 'Could not load your chats.' : 'Loading...'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-14 h-14 bg-[#2d3449] border border-[#5c3f40] rounded-2xl flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-[#ffb3b6] text-3xl">upload_file</span>
        </div>
        <h1 className="text-2xl font-bold">
          {chats.length ? 'Pick a chat or start a new one' : 'Start your first chat'}
        </h1>
        <p className="text-[#e5bdbe] text-sm">
          Each chat is tied to one PDF. Use <b>New Chat (PDF)</b> in the sidebar to upload a
          document and ask questions about it.
        </p>
      </div>
    </div>
  );
}
