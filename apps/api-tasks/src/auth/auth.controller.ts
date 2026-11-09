import { Controller, Post, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../chats/jwt-auth.guard';

@Controller('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Post('guest')
  async guest() {
    return this.authService.createGuest();
  }

  @Delete('guest')
  @UseGuards(JwtAuthGuard)
  async deleteGuest(@Req() req: any) {
    return this.authService.deleteGuest(req.user.sub);
  }

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: any) {
    return this.authService.resetPassword(body);
  }
}