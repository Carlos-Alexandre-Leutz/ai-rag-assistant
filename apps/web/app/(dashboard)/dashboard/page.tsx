'use client';

import { useChats } from '@/components/ChatsProvider';
import { useChatUpload } from '@/components/useChatUpload';
import { GUEST_MAX_FILE_MB } from '@/lib/chats';

function GuestWelcome({ documents, questions }: { documents: number; questions: number }) {
  const upload = useChatUpload();

  return (
    <div className="flex-1 overflow-y-auto p-4 pt-20">
      <div className="max-w-[800px] mx-auto flex flex-col items-start gap-3">
        <div className="max-w-[85%] px-5 py-4 rounded-2xl rounded-tl-none bg-[#171f33] text-[#dae2fd] border border-[#5c3f40] text-sm space-y-3">
          <p>
            Hi! I&apos;m <b>Vermilion</b>, a document assistant. Upload a PDF and ask me anything
            about it. I answer using only that document and show the pages I used as sources.
          </p>
          <p>You are trying it as a guest, so a few limits apply:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              {documents} PDF, up to {GUEST_MAX_FILE_MB} MB
            </li>
            <li>{questions} questions</li>
            <li>Everything is deleted after 24 hours</li>
          </ul>
          <p>Create a free account any time to remove these limits.</p>
        </div>

        <input
          type="file"
          accept="application/pdf,.pdf"
          ref={upload.inputRef}
          onChange={upload.handleFile}
          className="hidden"
        />
        <button
          onClick={upload.openPicker}
          disabled={upload.uploading}
          className="flex items-center gap-2 bg-[#e11d48] text-[#fffaf9] rounded-lg font-bold py-3 px-5 transition-all hover:brightness-110 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
        >
          <span className="material-symbols-outlined">
            {upload.uploading ? 'hourglass_top' : 'upload_file'}
          </span>
          <span className="font-mono text-xs">
            {upload.uploading ? 'Uploading...' : 'Upload a PDF'}
          </span>
        </button>
        {upload.error && <p className="text-xs text-[#ffb4ab]">{upload.error}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { chats, chatsStatus, usage } = useChats();

  if (chatsStatus !== 'ready') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className={chatsStatus === 'error' ? 'text-[#ffb4ab]' : 'text-[#e5bdbe]/70 animate-pulse'}>
          {chatsStatus === 'error' ? 'Could not load your chats.' : 'Loading...'}
        </p>
      </div>
    );
  }

  if (usage?.isGuest && chats.length === 0) {
    return <GuestWelcome documents={usage.documents.max} questions={usage.questions.max} />;
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
