'use client';

import React, { useState } from 'react';
import { ChatsProvider, useChats } from '@/components/ChatsProvider';
import ChatSidebar from '@/components/ChatSidebar';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { auth } = useChats();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (auth === 'loading') return null;

  // Guests get the standalone single-chat experience (it has its own layout).
  if (auth === 'guest') return <>{children}</>;

  return (
    <div className="font-sans text-sm overflow-hidden h-dvh flex flex-col md:flex-row bg-[#0b1326] text-[#dae2fd]">
      <ChatSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        <button
          className="lg:hidden absolute top-3 left-3 z-30 p-2 text-[#e5bdbe] hover:bg-[#2d3449] rounded-full transition-colors"
          onClick={() => setDrawerOpen(true)}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatsProvider>
      <DashboardShell>{children}</DashboardShell>
    </ChatsProvider>
  );
}
