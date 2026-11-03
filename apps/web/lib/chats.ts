import api from '@/lib/api';

export type ChatSummary = {
  id: string;
  title: string;
  documentId: string;
  updatedAt: string;
  document: {
    filename: string;
    status: 'PROCESSING' | 'READY' | 'FAILED';
    failureReason?: string | null;
  };
};

export type ChatMessage = {
  id: string;
  role: 'USER' | 'AI';
  content: string;
  createdAt: string;
};

export const listChats = () => api.get<ChatSummary[]>('/chats').then((r) => r.data);

export const getChat = (id: string) => api.get<ChatSummary>(`/chats/${id}`).then((r) => r.data);

export const getMessages = (id: string) =>
  api.get<ChatMessage[]>(`/chats/${id}/messages`).then((r) => r.data);

export const deleteChat = (id: string) => api.delete(`/chats/${id}`);

export const createChatFromFile = (file: File) => {
  const form = new FormData();
  form.append('filename', file.name);
  form.append('file', file);
  return api
    .post<ChatSummary>('/chats', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

export const sendMessage = (id: string, content: string) =>
  api
    .post<{ userMessage: ChatMessage; aiMessage: ChatMessage }>(`/chats/${id}/messages`, { content })
    .then((r) => r.data);

export const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.response?.data?.detail || fallback;

export const isUnauthorized = (error: any) => error?.response?.status === 401;
