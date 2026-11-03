import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatsService } from './chats.service';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  list(@Headers('authorization') authorization: string) {
    return this.chatsService.list(authorization);
  }

  // multipart/form-data with a single "file" field (a PDF). The multipart
  // plugin runs with attachFieldsToBody: 'keyValues', so the file arrives as a
  // Buffer and its name travels in the "filename" field.
  @Post()
  create(@Req() req: any, @Headers('authorization') authorization: string) {
    const body = req.body as { file?: Buffer; filename?: string };
    if (!Buffer.isBuffer(body?.file)) {
      throw new BadRequestException('Envie um arquivo PDF no campo "file".');
    }

    const filename = String(body.filename || 'document.pdf');
    if (
      !filename.toLowerCase().endsWith('.pdf') ||
      !body.file.subarray(0, 1024).includes('%PDF-')
    ) {
      throw new BadRequestException('Only valid PDF files are supported.');
    }

    return this.chatsService.createFromFile(authorization, req.user.sub, {
      buffer: body.file,
      filename,
      mimetype: 'application/pdf',
    });
  }

  @Get(':id')
  get(@Headers('authorization') authorization: string, @Param('id') id: string) {
    return this.chatsService.get(authorization, id);
  }

  @Delete(':id')
  remove(@Headers('authorization') authorization: string, @Param('id') id: string) {
    return this.chatsService.remove(authorization, id);
  }

  @Get(':id/messages')
  messages(@Headers('authorization') authorization: string, @Param('id') id: string) {
    return this.chatsService.messages(authorization, id);
  }

  @Post(':id/messages')
  send(
    @Req() req: any,
    @Headers('authorization') authorization: string,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    if (!content?.trim()) {
      throw new BadRequestException('content é obrigatório.');
    }
    return this.chatsService.sendMessage(authorization, req.user.sub, id, content.trim());
  }
}
