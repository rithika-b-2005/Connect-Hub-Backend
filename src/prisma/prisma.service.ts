import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({ adapter: PrismaService.buildAdapter(config) });
  }

  // An explicit config object rather than a URL: the managed MySQL provider
  // needs TLS with certificate verification off (self-signed cert), and the
  // URL dialect has no unambiguous way to express that.
  private static buildAdapter(config: ConfigService) {
    return new PrismaMariaDb({
      host: config.getOrThrow<string>('DB_HOST'),
      port: Number(config.get<string>('DB_PORT') ?? 3306),
      user: config.getOrThrow<string>('DB_USERNAME'),
      password: config.getOrThrow<string>('DB_PASSWORD'),
      database: config.getOrThrow<string>('DB_NAME'),
      ssl:
        config.get('DB_SSL') === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
      connectTimeout: 10000,
      connectionLimit: 10,
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
