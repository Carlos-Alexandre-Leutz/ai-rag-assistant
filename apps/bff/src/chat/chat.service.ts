import { Injectable, ForbiddenException, BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData = require('form-data');

@Injectable()
export class ChatService {
  constructor(private readonly httpService: HttpService) {}

  async chat(
    userId: string,
    message: string,
    messagesCount: number = 0,
    file?: any,
    isGuest: boolean = false,
  ): Promise<any> {
    if (isGuest && messagesCount >= 10) {
      throw new ForbiddenException(
        'Limit of 10 questions reached. Please create an account to continue.',
      );
    }

    const url = `${process.env.AI_SERVICE_URL}/chat`;

    const formData = new FormData() as any;
    formData.append('user_id', userId || '');
    formData.append('message', message || '');

    if (file && file.buffer) {
      const fileName = file.filename || file.originalname || 'documento.pdf';
      const contentType = file.mimetype || 'application/pdf';

      formData.append('file', file.buffer, {
        filename: fileName,
        contentType: contentType,
      });
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: {
            ...formData.getHeaders(),
          },
        }),
      );

      return {
        ...response.data,
        messagesCount: isGuest ? messagesCount + 1 : messagesCount,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadGatewayException('Erro ao comunicar com o serviço de IA.');
    }
  }
}