import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DocumentStatus, MessageRole, Prisma } from '@prisma/client';
import { GUEST_LIMITS } from '../auth/guest-limits';
import { PrismaService } from '../prisma/prisma.service';

const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  // Every query filters by userId, so one user can never reach another's chat.
  private async findOwnedChat(userId: string, chatId: string) {
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId, userId },
      include: { document: true },
    });
    if (!chat) throw new NotFoundException('Chat não encontrado.');
    return chat;
  }

  private failStaleDocuments(userId: string) {
    return this.prisma.document.updateMany({
      where: {
        userId,
        status: DocumentStatus.PROCESSING,
        createdAt: { lt: new Date(Date.now() - PROCESSING_TIMEOUT_MS) },
      },
      data: {
        status: DocumentStatus.FAILED,
        failureReason: 'Processing took too long and was interrupted. Please upload the file again.',
      },
    });
  }

  async create(userId: string, filename: string, isGuest = false) {
    if (isGuest) {
      const { count } = await this.prisma.user.updateMany({
        where: { id: userId, isGuest: true, documentsUsed: { lt: GUEST_LIMITS.maxDocuments } },
        data: { documentsUsed: { increment: 1 } },
      });
      if (count === 0) {
        throw new ForbiddenException(
          `Guest accounts can upload ${GUEST_LIMITS.maxDocuments} document. Create an account to add more.`,
        );
      }
    }

    const document = await this.prisma.document.create({
      data: { userId, filename },
    });
    const chat = await this.prisma.chat.create({
      data: { userId, documentId: document.id, title: filename },
      include: { document: true },
    });
    return chat;
  }

  async usage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isGuest: true, expiresAt: true, documentsUsed: true, questionsUsed: true },
    });
    if (!user) throw new UnauthorizedException('Session ended.');
    if (!user.isGuest) return { isGuest: false };
    return {
      isGuest: true,
      expiresAt: user.expiresAt,
      documents: { used: user.documentsUsed, max: GUEST_LIMITS.maxDocuments },
      questions: { used: user.questionsUsed, max: GUEST_LIMITS.maxQuestions },
    };
  }

  async list(userId: string) {
    await this.failStaleDocuments(userId);
    return this.prisma.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        document: { select: { filename: true, status: true, failureReason: true } },
      },
    });
  }

  async get(userId: string, chatId: string) {
    await this.failStaleDocuments(userId);
    return this.findOwnedChat(userId, chatId);
  }

  async remove(userId: string, chatId: string) {
    const chat = await this.findOwnedChat(userId, chatId);
    // Deleting the document cascades to the chat, its messages and its chunks.
    await this.prisma.document.delete({ where: { id: chat.documentId } });
    return { deleted: true };
  }

  async setDocumentStatus(
    userId: string,
    chatId: string,
    status: DocumentStatus,
    failureReason?: string,
  ) {
    const chat = await this.findOwnedChat(userId, chatId);
    if (status === DocumentStatus.FAILED) {
      await this.prisma.user.updateMany({
        where: { id: userId, isGuest: true, documentsUsed: { gt: 0 } },
        data: { documentsUsed: { decrement: 1 } },
      });
    }
    return this.prisma.document.update({
      where: { id: chat.documentId },
      data: {
        status,
        failureReason:
          status === DocumentStatus.FAILED ? (failureReason ?? null) : null,
      },
    });
  }

  async listMessages(userId: string, chatId: string) {
    await this.findOwnedChat(userId, chatId);
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removeAiMessage(userId: string, chatId: string, messageId: string) {
    await this.findOwnedChat(userId, chatId);
    const { count } = await this.prisma.message.deleteMany({
      where: { id: messageId, chatId, role: MessageRole.AI },
    });
    if (count === 0) throw new NotFoundException('Mensagem não encontrada.');
    return { deleted: true };
  }

  async addMessage(
    userId: string,
    chatId: string,
    role: MessageRole,
    content: string,
    sources?: Prisma.InputJsonValue,
    isGuest = false,
  ) {
    await this.findOwnedChat(userId, chatId);
    if (isGuest && role === MessageRole.USER) {
      const { count } = await this.prisma.user.updateMany({
        where: { id: userId, isGuest: true, questionsUsed: { lt: GUEST_LIMITS.maxQuestions } },
        data: { questionsUsed: { increment: 1 } },
      });
      if (count === 0) {
        throw new ForbiddenException(
          `Guest limit reached: ${GUEST_LIMITS.maxQuestions} questions. Create an account to keep chatting.`,
        );
      }
    }
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { chatId, role, content, ...(sources ? { sources } : {}) },
      }),
      // Bumps updatedAt so the chat moves to the top of the sidebar.
      this.prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } }),
    ]);
    return message;
  }
}
