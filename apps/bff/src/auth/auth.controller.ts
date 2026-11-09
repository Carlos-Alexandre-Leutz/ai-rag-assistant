import {
  Controller,
  Post,
  Delete,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  HttpCode,
  Req,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginDto } from './dto/login.dto';
import axios from 'axios';
import { allowRequest } from '../common/rate-limit';

const GUEST_CREATIONS_PER_HOUR = 10;

@Controller('auth')
export class AuthController {
  private readonly coreAuthUrl = process.env.TASKS_API_URL;

  constructor(private readonly httpService: HttpService) {}

  @Post('register')
  async register(@Body() body: any) {
    try {
      const response = await axios.post(`${this.coreAuthUrl}/auth/register`, body);

      return response.data;
    } catch (error) {
      throw new HttpException(
        'Error connecting to API',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.coreAuthUrl}/auth/login`, dto)
      );
      return response.data;
    } catch (error: any) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data?.message || 'Erro ao realizar login';
      throw new HttpException(message, status);
    }
  }
  @Post('guest')
  async guest(@Req() req: any) {
    if (!allowRequest(`guest:${req.ip}`, GUEST_CREATIONS_PER_HOUR, 60 * 60 * 1000)) {
      throw new HttpException(
        'Too many guest sessions from this network. Try again later or create an account.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.coreAuthUrl}/auth/guest`),
      );
      return response.data;
    } catch (error: any) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data?.message || 'Erro ao criar sessão de visitante';
      throw new HttpException(message, status);
    }
  }

  @Delete('guest')
  async deleteGuest(@Headers('authorization') authorization: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.delete(`${this.coreAuthUrl}/auth/guest`, {
          headers: { Authorization: authorization },
        }),
      );
      return response.data;
    } catch (error: any) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data?.message || 'Erro ao encerrar a sessão';
      throw new HttpException(message, status);
    }
  }

  @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${this.coreAuthUrl}/auth/forgot-password`, { email: dto.email })
        );
        return response.data;
      } catch (error: any) {
        const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const message = error.response?.data?.message || 'Erro ao processar solicitação';
        throw new HttpException(message, status);
      }
    }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.coreAuthUrl}/auth/reset-password`, dto)
      );
      return response.data;
    } catch (error: any) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data?.message || 'Erro ao resetar senha';
      throw new HttpException(message, status);
    }
  }
}