import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData = require('form-data');

@Injectable()
export class ChatService {
  constructor(private readonly httpService: HttpService) {}

  async chat(userId: string, message: string, file?: any): Promise<any> {
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

    const response = await firstValueFrom(
      this.httpService.post(url, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      }),
    );
    return response.data;
  }
}