import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';

// Strict version of AuthGuard: only a valid JWT passes, guests are rejected.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const [type, token] = (request.headers.authorization || '').split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Faça login para continuar.');
    }

    try {
      (request as any).user = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'seu_secret_aqui',
      });
      return true;
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
  }
}
