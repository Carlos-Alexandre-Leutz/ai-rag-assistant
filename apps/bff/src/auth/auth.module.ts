import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    HttpModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'sua_chave_secreta_aqui',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}