import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [ChatsController],
  providers: [ChatsService],
})
export class ChatsModule {}
