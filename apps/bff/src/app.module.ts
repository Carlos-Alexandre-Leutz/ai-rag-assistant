import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';

@Module({
  imports: [AuthModule, ChatsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
