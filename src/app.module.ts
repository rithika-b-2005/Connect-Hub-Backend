import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { Like } from './entities/like.entity';
import { Post } from './entities/post.entity';
import { User } from './entities/user.entity';
import { PostsModule } from './posts/posts.module';
import { SeedModule } from './seed/seed.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        // Managed MySQL providers (Aiven) require TLS connections
        ssl:
          config.get('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : undefined,
        entities: [User, Post, Like],
        // Auto-creates tables from entities. Dev convenience only;
        // production would use migrations instead.
        synchronize: true,
      }),
    }),
    AuthModule,
    UsersModule,
    PostsModule,
    AnalyticsModule,
    SeedModule,
  ],
})
export class AppModule {}
