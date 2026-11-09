import api, { API_URL } from '@/lib/api';

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

export type Source = {
  filename: string;
  page: number | null;
  excerpt: string;
  distance: number;
};

export type ChatMessage = {
  id: string;
  role: 'USER' | 'AI';
  content: string;
  sources?: Source[] | null;
  createdAt: string;
};

export const listChats = () => api.get<ChatSummary[]>('/chats').then((r) => r.data);

export const getChat = (id: string) => api.get<ChatSummary>(`/chats/${id}`).then((r) => r.data);

export const getMessages = (id: string) =>
  api.get<ChatMessage[]>(`/chats/${id}/messages`).then((r) => r.data);

export const GUEST_MAX_FILE_MB = 10;

export type Usage =
  | { isGuest: false }
  | {
      isGuest: true;
      expiresAt: string;
      documents: { used: number; max: number };
      questions: { used: number; max: number };
    };

export const getUsage = () => api.get<Usage>('/chats/usage').then((r) => r.data);

export const createGuestSession = () =>
  api
    .post<{ access_token: string; name: string; expiresAt: string }>('/auth/guest')
    .then((r) => r.data);

export const endGuestSession = () => api.delete('/auth/guest');

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

export type StreamHandlers = {
  onSources: (sources: Source[]) => void;
  onDelta: (text: string) => void;
};

const streamFailure = (status: number, message: string) => ({
  response: { status, data: { message } },
});

const postStream = async (path: string, body: unknown, handlers: StreamHandlers) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token && token !== 'undefined' && token !== 'null'
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw { response: { status: response.status, data } };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: { userMessage: ChatMessage; aiMessage: ChatMessage } | null = null;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === 'sources') handlers.onSources(event.sources);
    else if (event.type === 'delta') handlers.onDelta(event.text);
    else if (event.type === 'error') throw streamFailure(502, event.detail);
    else if (event.type === 'done') {
      result = { userMessage: event.userMessage, aiMessage: event.aiMessage };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(handleLine);
  }
  handleLine(buffer);

  if (!result) throw streamFailure(502, 'The answer was interrupted.');
  return result;
};

export const streamMessage = (id: string, content: string, handlers: StreamHandlers) =>
  postStream(`/chats/${id}/messages/stream`, { content }, handlers);

export const streamAnswer = (id: string, handlers: StreamHandlers) =>
  postStream(`/chats/${id}/answer/stream`, undefined, handlers);

export const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.response?.data?.detail || fallback;

export const isUnauthorized = (error: any) => error?.response?.status === 401;
