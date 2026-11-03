import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DocumentStatus, MessageRole } from '@prisma/client';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post()
  create(@Req() req: any, @Body('filename') filename: string) {
    if (!filename?.trim()) {
      throw new BadRequestException('filename é obrigatório.');
    }
    return this.chatsService.create(req.user.sub, filename.trim());
  }

  @Get()
  list(@Req() req: any) {
    return this.chatsService.list(req.user.sub);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.chatsService.get(req.user.sub, id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.chatsService.remove(req.user.sub, id);
  }

  @Patch(':id/document')
  setDocumentStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: DocumentStatus,
  ) {
    if (!Object.values(DocumentStatus).includes(status)) {
      throw new BadRequestException('status inválido.');
    }
    return this.chatsService.setDocumentStatus(req.user.sub, id, status);
  }

  @Get(':id/messages')
  listMessages(@Req() req: any, @Param('id') id: string) {
    return this.chatsService.listMessages(req.user.sub, id);
  }

  @Post(':id/messages')
  addMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { role: MessageRole; content: string },
  ) {
    if (!Object.values(MessageRole).includes(body?.role) || !body?.content?.trim()) {
      throw new BadRequestException('role e content são obrigatórios.');
    }
    return this.chatsService.addMessage(req.user.sub, id, body.role, body.content);
  }
}
