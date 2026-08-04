import { Controller, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { FastifyFormData } from './fastify-form-data.decorator';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@FastifyFormData() payload: { userId: string; message: string; file?: any }) {
    return this.chatService.chat(payload.userId, payload.message, payload.file);
  }
}