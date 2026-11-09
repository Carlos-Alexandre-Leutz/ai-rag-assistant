import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChats } from '@/components/ChatsProvider';
import {
  GUEST_MAX_FILE_MB,
  createChatFromFile,
  errorMessage,
  isUnauthorized,
} from '@/lib/chats';

export function useChatUpload(onDone?: () => void) {
  const router = useRouter();
  const { usage, refreshChats, handleExpiredSession } = useChats();
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (usage?.isGuest && file.size > GUEST_MAX_FILE_MB * 1024 * 1024) {
      setError(`Guest accounts can upload files up to ${GUEST_MAX_FILE_MB} MB.`);
      return;
    }

    setError('');
    setUploading(true);
    try {
      const chat = await createChatFromFile(file);
      await refreshChats();
      onDone?.();
      router.push(`/dashboard/${chat.id}`);
    } catch (err) {
      if (isUnauthorized(err)) return handleExpiredSession();
      setError(errorMessage(err, 'Could not process the document.'));
    } finally {
      setUploading(false);
    }
  };

  return {
    inputRef,
    uploading,
    error,
    openPicker: () => inputRef.current?.click(),
    handleFile,
  };
}
