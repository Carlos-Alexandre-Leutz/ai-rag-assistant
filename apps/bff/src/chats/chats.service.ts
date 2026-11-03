import {
  BadGatewayException,
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData = require('form-data');

const HISTORY_LIMIT = 10;
const INGEST_TIMEOUT_MS = 10 * 60 * 1000;

export type UploadedFile = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
};

// Orchestrates the logged-in chats: data lives in api-tasks, embeddings and
// answers in ai-service. The caller's JWT is forwarded so api-tasks can
// enforce ownership by itself.
@Injectable()
export class ChatsService {
  constructor(private readonly http: HttpService) {}

  private get tasksUrl() {
    return process.env.TASKS_API_URL;
  }

  private get aiUrl() {
    return process.env.AI_SERVICE_URL;
  }

  private async tasks<T = any>(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    authorization: string,
    data?: unknown,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.request<T>({
          method,
          url: `${this.tasksUrl}${path}`,
          data,
          headers: { Authorization: authorization },
        }),
      );
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(
          error.response.data?.message || 'Erro na API de dados.',
          error.response.status,
        );
      }
      throw new BadGatewayException('Erro ao comunicar com a API de dados.');
    }
  }

  list(authorization: string) {
    return this.tasks('get', '/chats', authorization);
  }

  get(authorization: string, chatId: string) {
    return this.tasks('get', `/chats/${chatId}`, authorization);
  }

  remove(authorization: string, chatId: string) {
    return this.tasks('delete', `/chats/${chatId}`, authorization);
  }

  messages(authorization: string, chatId: string) {
    return this.tasks('get', `/chats/${chatId}/messages`, authorization);
  }

  // Upload -> create document+chat (PROCESSING) -> answer right away. Embedding
  // runs in the background and ends with the document READY or FAILED (with the
  // reason), which the UI picks up by polling.
  async createFromFile(authorization: string, userId: string, file: UploadedFile) {
    const chat = await this.tasks('post', '/chats', authorization, {
      filename: file.filename,
    });

    void this.ingest(authorization, userId, chat, file);
    return chat;
  }

  private async ingest(
    authorization: string,
    userId: string,
    chat: { id: string; documentId: string },
    file: UploadedFile,
  ) {
    let body: { status: string; failureReason?: string };
    try {
      const form = new FormData() as any;
      form.append('user_id', userId);
      form.append('document_id', chat.documentId);
      form.append('file', file.buffer, {
        filename: file.filename,
        contentType: file.mimetype,
      });

      await firstValueFrom(
        this.http.post(`${this.aiUrl}/rag/process-pdf`, form, {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
          timeout: INGEST_TIMEOUT_MS,
        }),
      );
      body = { status: 'READY' };
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      body = {
        status: 'FAILED',
        failureReason:
          typeof detail === 'string' ? detail : 'Could not process the document.',
      };
    }

    try {
      await this.tasks('patch', `/chats/${chat.id}/document`, authorization, body);
    } catch (error) {
      // The stale-document sweep in api-tasks will eventually mark it FAILED.
      console.error(`Could not update document status for chat ${chat.id}`, error);
    }
  }

  async sendMessage(
    authorization: string,
    userId: string,
    chatId: string,
    content: string,
  ) {
    const chat = await this.get(authorization, chatId);
    if (chat.document?.status !== 'READY') {
      throw new ConflictException(
        'This document is not ready yet. Wait until it finishes processing.',
      );
    }
    const previous: { role: string; content: string }[] = await this.messages(
      authorization,
      chatId,
    );

    const userMessage = await this.tasks(
      'post',
      `/chats/${chatId}/messages`,
      authorization,
      { role: 'USER', content },
    );

    let answer: string;
    let sources: unknown[] = [];
    try {
      const form = new FormData() as any;
      form.append('user_id', userId);
      form.append('document_id', chat.documentId);
      form.append('message', content);
      form.append(
        'history',
        JSON.stringify(
          previous
            .slice(-HISTORY_LIMIT)
            .map((m) => ({ role: m.role, content: m.content })),
        ),
      );

      const response = await firstValueFrom(
        this.http.post(`${this.aiUrl}/chat`, form, { headers: form.getHeaders() }),
      );
      answer = response.data.response;
      sources = Array.isArray(response.data.sources) ? response.data.sources : [];
    } catch {
      throw new BadGatewayException('Erro ao comunicar com o serviço de IA.');
    }

    const aiMessage = await this.tasks(
      'post',
      `/chats/${chatId}/messages`,
      authorization,
      { role: 'AI', content: answer, sources },
    );
    return { userMessage, aiMessage };
  }
}
