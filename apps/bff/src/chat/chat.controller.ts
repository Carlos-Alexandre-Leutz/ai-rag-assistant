import { Controller, Post, UseGuards, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { FastifyFormData } from './fastify-form-data.decorator';
import { AuthGuard } from '../auth/auth.guard';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(
    @Req() req: any,
    @FastifyFormData() payload: { userId: string; message: string; file?: any; messagesCount?: number },
  ) {
    console.log("chat request received, payload:", payload);

    const isGuest = !!req.user?.isGuest;
    const authenticatedUserId = req.user?.id || req.user?.sub || payload.userId;
    const messagesCount = Number(payload.messagesCount) || 0;

    console.log("Processing chat for", isGuest ? "guest" : "user", "with count", messagesCount);

    return this.chatService.chat(
      authenticatedUserId,
      payload.message,
      messagesCount,
      payload.file,
      isGuest,
    );
  }
}