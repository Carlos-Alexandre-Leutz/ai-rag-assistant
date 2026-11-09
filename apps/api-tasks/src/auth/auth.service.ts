import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { GUEST_LIMITS } from './guest-limits';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private jwtService: JwtService,
  ) {}

  async register(data: any) {
    const userExists = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (userExists) {
      throw new ConflictException('Este e-mail já está cadastrado');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
      },
    });

    const { password, ...result } = user;
    return result;
  }
  async createGuest() {
    const activeGuests = await this.prisma.user.count({
      where: { isGuest: true, expiresAt: { gt: new Date() } },
    });
    if (activeGuests >= GUEST_LIMITS.maxActiveGuests) {
      throw new ServiceUnavailableException(
        'Too many guest sessions right now. Try again later or create an account.',
      );
    }

    const expiresAt = new Date(Date.now() + GUEST_LIMITS.ttlMs);
    const user = await this.prisma.user.create({
      data: { name: 'Guest', isGuest: true, expiresAt },
    });
    const access_token = await this.jwtService.signAsync(
      { sub: user.id, isGuest: true },
      { expiresIn: Math.floor(GUEST_LIMITS.ttlMs / 1000) },
    );
    return { access_token, name: user.name, isGuest: true, expiresAt };
  }

  async deleteGuest(userId: string) {
    await this.prisma.user.deleteMany({ where: { id: userId, isGuest: true } });
    return { deleted: true };
  }

  async login(data: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = { sub: user.id, email: user.email };
    const access_token = await this.jwtService.signAsync(payload);

    const { password, ...result } = user;
    return {
      ...result,
      access_token,
    };
  }
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const token = crypto.randomBytes(20).toString('hex');

    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    await this.mailService.sendPasswordReset(email, token);

    return {
      message: 'E-mail de recuperação enviado com sucesso!',
    };
  }

  async resetPassword(data: any) {
    const { token, newPassword } = data;

    if (!token || !newPassword) {
      throw new BadRequestException('Token e nova senha são obrigatórios');
    }

    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: token },
    });

    if (!user) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    if (user.passwordResetExpires && new Date() > new Date(user.passwordResetExpires)) {
      throw new BadRequestException('Token expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return { message: 'Senha alterada com sucesso!' };
  }
}