import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';

// Seeds demo users, posts and likes on first boot so the app
// (and the analytics dashboard) has data to show immediately.
@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    if (this.config.get('NODE_ENV') !== 'development') return;

    await this.prisma.$transaction(async (tx) => {
      if ((await tx.post.count()) > 0) return;
      const demoEmails = [
        'alex@connecthub.com',
        'priya@connecthub.com',
        'rahul@connecthub.com',
      ];
      const existingDemoUsers = await tx.user.count({
        where: { email: { in: demoEmails } },
      });
      if (existingDemoUsers === demoEmails.length) return;

      const password = await bcrypt.hash('user123', 10);
      const [alex, priya, rahul] = await Promise.all([
        tx.user.upsert({
          where: { email: 'alex@connecthub.com' },
          update: {},
          create: {
            name: 'Alex Kumar',
            email: 'alex@connecthub.com',
            password,
            role: UserRole.USER,
          },
        }),
        tx.user.upsert({
          where: { email: 'priya@connecthub.com' },
          update: {},
          create: {
            name: 'Priya Sharma',
            email: 'priya@connecthub.com',
            password,
            role: UserRole.USER,
          },
        }),
        tx.user.upsert({
          where: { email: 'rahul@connecthub.com' },
          update: {},
          create: {
            name: 'Rahul Dev',
            email: 'rahul@connecthub.com',
            password,
            role: UserRole.USER,
          },
        }),
      ]);

      const posts = await Promise.all([
        tx.post.create({
          data: {
            title: 'Welcome to ConnectHub!',
            description:
              'Excited to join this community. Looking forward to sharing updates and learning from everyone here.',
            authorId: alex.id,
            views: 142,
          },
        }),
        tx.post.create({
          data: {
            title: 'Tips for writing clean React components',
            description:
              'Keep components small, lift state only when needed, and prefer composition over prop drilling. A thread on what worked for our team.',
            authorId: priya.id,
            views: 387,
          },
        }),
        tx.post.create({
          data: {
            title: 'Our journey migrating to NestJS',
            description:
              'We moved our Express API to NestJS over two sprints. Modules and dependency injection made the codebase far easier to navigate.',
            authorId: rahul.id,
            views: 256,
          },
        }),
        tx.post.create({
          data: {
            title: 'Design systems save time',
            description:
              'Adopting a shared color and spacing scale cut our UI review time in half. Consistency beats creativity in enterprise apps.',
            authorId: alex.id,
            views: 198,
          },
        }),
        tx.post.create({
          data: {
            title: 'MySQL indexing basics every dev should know',
            description:
              'A quick primer on when to add indexes, how composite indexes work, and reading EXPLAIN output without fear.',
            authorId: priya.id,
            views: 310,
          },
        }),
      ]);

      const likePairs: Array<[number, number]> = [
        [priya.id, posts[0].id],
        [rahul.id, posts[0].id],
        [alex.id, posts[1].id],
        [rahul.id, posts[1].id],
        [priya.id, posts[2].id],
        [alex.id, posts[4].id],
        [rahul.id, posts[3].id],
      ];
      await tx.like.createMany({
        data: likePairs.map(([userId, postId]) => ({ userId, postId })),
      });
    });
  }
}
