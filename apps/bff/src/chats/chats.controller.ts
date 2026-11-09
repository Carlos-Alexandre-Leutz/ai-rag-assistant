import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  PayloadTooLargeException,
  Post,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { allowRequest } from '../common/rate-limit';
import { ChatsService } from './chats.service';

const GUEST_MAX_FILE_BYTES = 10 * 1024 * 1024;
const GUEST_GENERATIONS_PER_MINUTE = 10;

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  private throttleGuest(req: any) {
    if (
      req.user.isGuest &&
      !allowRequest(`generate:${req.user.sub}`, GUEST_GENERATIONS_PER_MINUTE, 60 * 1000)
    ) {
      throw new HttpException(
        'Too many requests. Wait a moment before asking again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

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

    if (req.user.isGuest && body.file.length > GUEST_MAX_FILE_BYTES) {
      throw new PayloadTooLargeException(
        'Guest accounts can upload files up to 10 MB. Create an account for up to 20 MB.',
      );
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

  @Get('usage')
  usage(@Headers('authorization') authorization: string) {
    return this.chatsService.usage(authorization);
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

  @Post(':id/messages/stream')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Accel-Buffering', 'no')
  async stream(
    @Req() req: any,
    @Headers('authorization') authorization: string,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    if (!content?.trim()) {
      throw new BadRequestException('content é obrigatório.');
    }
    this.throttleGuest(req);
    const output = await this.chatsService.streamMessage(
      authorization,
      req.user.sub,
      id,
      content.trim(),
    );
    return new StreamableFile(output, { type: 'application/x-ndjson' });
  }

  @Post(':id/answer/stream')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Accel-Buffering', 'no')
  async answer(
    @Req() req: any,
    @Headers('authorization') authorization: string,
    @Param('id') id: string,
  ) {
    this.throttleGuest(req);
    const output = await this.chatsService.streamAnswer(authorization, req.user.sub, id);
    return new StreamableFile(output, { type: 'application/x-ndjson' });
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
    this.throttleGuest(req);
    return this.chatsService.sendMessage(authorization, req.user.sub, id, content.trim());
  }
}
