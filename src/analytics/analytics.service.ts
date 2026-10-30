import { Injectable } from '@nestjs/common';
import { UserRole } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';

type AuthUser = { id: number; role: UserRole };

type RawChartRow = {
  id: number | bigint;
  title: string;
  views: number | bigint;
  createdAt: Date;
  authorName: string | null;
  likes: number | bigint;
};

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // Same endpoint for both roles: admin gets platform-wide numbers,
  // a regular user gets stats for their own posts only.
  summary(me: AuthUser) {
    return me.role === UserRole.ADMIN
      ? this.adminSummary()
      : this.userSummary(me.id);
  }

  private async adminSummary() {
    const [totalPosts, totalLikes, totalUsers] = await Promise.all([
      this.prisma.post.count(),
      this.prisma.like.count(),
      this.prisma.user.count(),
    ]);

    const viewsAgg = await this.prisma.post.aggregate({
      _sum: { views: true },
    });

    const topPosts = await this.topPosts(5);
    const likesPerPost = await this.topPosts(7);

    return {
      role: 'admin',
      stats: {
        totalPosts,
        totalLikes,
        totalViews: Number(viewsAgg._sum.views ?? 0),
        totalUsers,
      },
      likesPerPost,
      topPosts,
    };
  }

  private async userSummary(userId: number) {
    const myPosts = await this.prisma.post.count({
      where: { authorId: userId },
    });

    const likesReceived = await this.prisma.like.count({
      where: { post: { authorId: userId } },
    });

    const viewsAgg = await this.prisma.post.aggregate({
      where: { authorId: userId },
      _sum: { views: true },
    });

    const myRecent = await this.topPosts(7, userId);

    return {
      role: 'user',
      stats: {
        myPosts,
        likesReceived,
        viewsReceived: Number(viewsAgg._sum.views ?? 0),
      },
      likesPerPost: myRecent,
      recentPosts: myRecent,
    };
  }

  // Prisma's groupBy cannot join author.name and cannot order by an
  // aggregate, so this stays raw SQL. The column aliases and the aggregate
  // semantics match what the chart and list on the dashboard read.
  //
  // CAST(... AS SIGNED) keeps the count a plain integer: MySQL returns
  // COUNT() as a BIGINT, and a BigInt cannot be serialised to JSON.
  private async topPosts(limit: number, authorId?: number) {
    const rows =
      authorId === undefined
        ? await this.prisma.$queryRaw<RawChartRow[]>`
            SELECT
              p.id AS id,
              p.title AS title,
              p.views AS views,
              p.createdAt AS createdAt,
              u.name AS authorName,
              CAST(COUNT(l.id) AS SIGNED) AS likes
            FROM posts p
            LEFT JOIN likes l ON l.postId = p.id
            LEFT JOIN users u ON u.id = p.authorId
            GROUP BY p.id, p.title, p.views, p.createdAt, u.name
            ORDER BY likes DESC
            LIMIT ${limit}
          `
        : await this.prisma.$queryRaw<RawChartRow[]>`
            SELECT
              p.id AS id,
              p.title AS title,
              p.views AS views,
              p.createdAt AS createdAt,
              u.name AS authorName,
              CAST(COUNT(l.id) AS SIGNED) AS likes
            FROM posts p
            LEFT JOIN likes l ON l.postId = p.id
            LEFT JOIN users u ON u.id = p.authorId
            WHERE p.authorId = ${authorId}
            GROUP BY p.id, p.title, p.views, p.createdAt, u.name
            ORDER BY p.createdAt DESC
            LIMIT ${limit}
          `;

    return rows.map((row) => this.toChartRow(row));
  }

  private toChartRow(row: RawChartRow) {
    return {
      id: Number(row.id),
      title: String(row.title),
      authorName: String(row.authorName),
      likes: Number(row.likes),
      views: Number(row.views),
      createdAt: row.createdAt,
    };
  }
}
