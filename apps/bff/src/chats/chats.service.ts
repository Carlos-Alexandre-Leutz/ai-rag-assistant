import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PassThrough } from 'stream';
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

  private async loadChatForAnswer(authorization: string, chatId: string) {
    const chat = await this.get(authorization, chatId);
    if (chat.document?.status !== 'READY') {
      throw new ConflictException(
        'This document is not ready yet. Wait until it finishes processing.',
      );
    }
    const previous: { id: string; role: string; content: string }[] =
      await this.messages(authorization, chatId);
    return { chat, previous };
  }

  async streamAnswer(authorization: string, userId: string, chatId: string) {
    const { chat, previous } = await this.loadChatForAnswer(authorization, chatId);

    const last = previous[previous.length - 1];
    const replaced = last?.role === 'AI' ? last : undefined;
    const history = replaced ? previous.slice(0, -1) : previous;
    const question = history[history.length - 1];
    if (!question || question.role !== 'USER') {
      throw new BadRequestException('There is no question to answer.');
    }

    const output = new PassThrough();
    void this.pipeAnswer(
      output,
      authorization,
      chatId,
      question,
      this.buildAnswerForm(userId, chat.documentId, question.content, history.slice(0, -1)),
      replaced?.id,
    );
    return output;
  }

  private buildAnswerForm(
    userId: string,
    documentId: string,
    content: string,
    previous: { role: string; content: string }[],
  ) {
    const form = new FormData() as any;
    form.append('user_id', userId);
    form.append('document_id', documentId);
    form.append('message', content);
    form.append(
      'history',
      JSON.stringify(
        previous
          .slice(-HISTORY_LIMIT)
          .map((m) => ({ role: m.role, content: m.content })),
      ),
    );
    return form;
  }

  async streamMessage(
    authorization: string,
    userId: string,
    chatId: string,
    content: string,
  ) {
    const { chat, previous } = await this.loadChatForAnswer(authorization, chatId);
    const userMessage = await this.tasks(
      'post',
      `/chats/${chatId}/messages`,
      authorization,
      { role: 'USER', content },
    );

    const output = new PassThrough();
    void this.pipeAnswer(
      output,
      authorization,
      chatId,
      userMessage,
      this.buildAnswerForm(userId, chat.documentId, content, previous),
    );
    return output;
  }

  private async pipeAnswer(
    output: PassThrough,
    authorization: string,
    chatId: string,
    userMessage: unknown,
    form: any,
    replaceMessageId?: string,
  ) {
    const controller = new AbortController();
    let finished = false;
    output.on('close', () => {
      if (!finished) controller.abort();
    });

    const send = (event: object) => {
      if (!output.destroyed) output.write(`${JSON.stringify(event)}\n`);
    };

    let answer = '';
    let sources: unknown[] = [];
    let completed = false;

    try {
      const response = await firstValueFrom(
        this.http.post(`${this.aiUrl}/chat/stream`, form, {
          headers: form.getHeaders(),
          responseType: 'stream',
          signal: controller.signal,
        }),
      );
      response.data.setEncoding('utf8');

      let buffer = '';
      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === 'sources') {
          sources = Array.isArray(event.sources) ? event.sources : [];
          send(event);
        } else if (event.type === 'delta') {
          answer += event.text;
          send(event);
        } else if (event.type === 'error') {
          throw new Error(event.detail);
        } else if (event.type === 'done') {
          completed = true;
        }
      };

      for await (const piece of response.data) {
        buffer += piece;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(handleLine);
      }
      handleLine(buffer);

      if (!completed || !answer.trim()) {
        throw new Error('The AI service ended the answer unexpectedly.');
      }

      const aiMessage = await this.tasks(
        'post',
        `/chats/${chatId}/messages`,
        authorization,
        { role: 'AI', content: answer, sources },
      );
      finished = true;
      if (replaceMessageId) {
        await this.tasks(
          'delete',
          `/chats/${chatId}/messages/${replaceMessageId}`,
          authorization,
        ).catch(() => undefined);
      }
      send({ type: 'done', userMessage, aiMessage });
    } catch (error: any) {
      finished = true;
      if (!controller.signal.aborted) {
        send({ type: 'error', detail: 'Erro ao comunicar com o serviço de IA.' });
      }
    } finally {
      output.end();
    }
  }

  async sendMessage(
    authorization: string,
    userId: string,
    chatId: string,
    content: string,
  ) {
    const { chat, previous } = await this.loadChatForAnswer(authorization, chatId);

    const userMessage = await this.tasks(
      'post',
      `/chats/${chatId}/messages`,
      authorization,
      { role: 'USER', content },
    );

    let answer: string;
    let sources: unknown[] = [];
    try {
      const form = this.buildAnswerForm(userId, chat.documentId, content, previous);

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
