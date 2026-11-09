import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'seu_secret_aqui',
    }),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, JwtAuthGuard],
})
export class ChatsModule {}
