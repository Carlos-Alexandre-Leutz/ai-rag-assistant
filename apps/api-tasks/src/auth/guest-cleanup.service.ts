import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CLEANUP_INTERVAL_MS =
  Number(process.env.GUEST_CLEANUP_INTERVAL_MS) || 10 * 60 * 1000;

@Injectable()
export class GuestCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GuestCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.removeExpired();
    this.timer = setInterval(() => void this.removeExpired(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async removeExpired() {
    try {
      const { count } = await this.prisma.user.deleteMany({
        where: { isGuest: true, expiresAt: { lt: new Date() } },
      });
      if (count > 0) this.logger.log(`Deleted ${count} expired guest account(s).`);
    } catch (error) {
      this.logger.error('Could not delete expired guest accounts.', error as Error);
    }
  }
}
