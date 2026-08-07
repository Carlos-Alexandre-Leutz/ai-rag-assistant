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
    @FastifyFormData() payload: { userId: string; message: string; file?: any },
  ) {
    const authenticatedUserId = req.user?.sub || req.user?.id || payload.userId;

    return this.chatService.chat(
      authenticatedUserId,
      payload.message,
      payload.file,
    );
  }
}