'use client';

import { useChats } from '@/components/ChatsProvider';
import { endGuestSession } from '@/lib/chats';

const timeLeft = (expiresAt: string) => {
  const minutes = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
};

export default function GuestBar() {
  const { usage, leaveTo } = useChats();
  if (!usage?.isGuest) return null;

  const endSession = async () => {
    if (!window.confirm('End the session? Your document and chats will be deleted now.')) return;
    await endGuestSession().catch(() => undefined);
    leaveTo('/login');
  };

  return (
    <div className="rounded-lg bg-[#171f33] border border-[#5c3f40] p-3 space-y-2 text-xs">
      <div className="font-mono text-[#ffb3b6]">Guest mode</div>
      <div className="flex justify-between text-[#dae2fd]">
        <span>Documents</span>
        <span>
          {usage.documents.used}/{usage.documents.max}
        </span>
      </div>
      <div className="flex justify-between text-[#dae2fd]">
        <span>Questions</span>
        <span>
          {usage.questions.used}/{usage.questions.max}
        </span>
      </div>
      <div className="text-[#e5bdbe]">Deleted in {timeLeft(usage.expiresAt)}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
        <button
          onClick={() => leaveTo('/register')}
          className="text-[#ffb3b6] underline underline-offset-2"
        >
          Create account
        </button>
        <button
          onClick={() => leaveTo('/login')}
          className="text-[#e5bdbe] underline underline-offset-2"
        >
          Log in
        </button>
        <button
          onClick={endSession}
          className="text-[#e5bdbe] underline underline-offset-2 hover:text-[#ffb4ab]"
        >
          End session
        </button>
      </div>
    </div>
  );
}
