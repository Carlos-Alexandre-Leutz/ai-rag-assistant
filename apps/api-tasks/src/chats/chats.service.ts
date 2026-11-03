import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, MessageRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  async create(userId: string, filename: string) {
    const document = await this.prisma.document.create({
      data: { userId, filename },
    });
    const chat = await this.prisma.chat.create({
      data: { userId, documentId: document.id, title: filename },
      include: { document: true },
    });
    return chat;
  }

  list(userId: string) {
    return this.prisma.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { document: { select: { filename: true, status: true } } },
    });
  }

  get(userId: string, chatId: string) {
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
  ) {
    const chat = await this.findOwnedChat(userId, chatId);
    return this.prisma.document.update({
      where: { id: chat.documentId },
      data: { status },
    });
  }

  async listMessages(userId: string, chatId: string) {
    await this.findOwnedChat(userId, chatId);
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMessage(
    userId: string,
    chatId: string,
    role: MessageRole,
    content: string,
  ) {
    await this.findOwnedChat(userId, chatId);
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { chatId, role, content } }),
      // Bumps updatedAt so the chat moves to the top of the sidebar.
      this.prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } }),
    ]);
    return message;
  }
}
