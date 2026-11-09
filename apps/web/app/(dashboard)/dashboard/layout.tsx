'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChatsProvider, useChats } from '@/components/ChatsProvider';
import ChatSidebar from '@/components/ChatSidebar';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { auth, authError } = useChats();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (auth === 'loading') return null;

  if (auth === 'unavailable') {
    return (
      <div className="font-sans h-dvh flex items-center justify-center p-6 bg-[#0b1326] text-[#dae2fd]">
        <div className="max-w-md text-center space-y-4">
          <p className="text-[#ffb4ab]">{authError}</p>
          <div className="flex justify-center gap-4 text-sm">
            <Link href="/login" className="text-[#ffb3b6] underline underline-offset-2">
              Log in
            </Link>
            <Link href="/register" className="text-[#ffb3b6] underline underline-offset-2">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
