import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from '../entities/like.entity';
import { Post } from '../entities/post.entity';
import { User, UserRole } from '../entities/user.entity';

type AuthUser = { id: number; role: UserRole };

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Post) private postsRepo: Repository<Post>,
    @InjectRepository(Like) private likesRepo: Repository<Like>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  // Same endpoint for both roles: admin gets platform-wide numbers,
  // a regular user gets stats for their own posts only.
  summary(me: AuthUser) {
    return me.role === UserRole.ADMIN
      ? this.adminSummary()
      : this.userSummary(me.id);
  }

  private async adminSummary() {
    const [totalPosts, totalLikes, totalUsers] = await Promise.all([
      this.postsRepo.count(),
      this.likesRepo.count(),
      this.usersRepo.count(),
    ]);

    const { totalViews } = await this.postsRepo
      .createQueryBuilder('post')
      .select('COALESCE(SUM(post.views), 0)', 'totalViews')
      .getRawOne();

    const topPosts = await this.topPostsQuery().limit(5).getRawMany();

    const likesPerPost = await this.topPostsQuery().limit(7).getRawMany();

    return {
      role: 'admin',
      stats: {
        totalPosts,
        totalLikes,
        totalViews: Number(totalViews),
        totalUsers,
      },
      likesPerPost: likesPerPost.map(this.toChartRow),
      topPosts: topPosts.map(this.toChartRow),
    };
  }

  private async userSummary(userId: number) {
    const myPosts = await this.postsRepo.count({
      where: { author: { id: userId } },
    });

    const likesReceived = await this.likesRepo
      .createQueryBuilder('like')
      .innerJoin('like.post', 'post')
      .where('post.authorId = :userId', { userId })
      .getCount();

    const { viewsReceived } = await this.postsRepo
      .createQueryBuilder('post')
      .select('COALESCE(SUM(post.views), 0)', 'viewsReceived')
      .where('post.authorId = :userId', { userId })
      .getRawOne();

    const myRecent = await this.topPostsQuery()
      .where('post.authorId = :userId', { userId })
      .orderBy('post.createdAt', 'DESC')
      .limit(7)
      .getRawMany();

    return {
      role: 'user',
      stats: {
        myPosts,
        likesReceived,
        viewsReceived: Number(viewsReceived),
      },
      likesPerPost: myRecent.map(this.toChartRow),
      recentPosts: myRecent.map(this.toChartRow),
    };
  }

  private topPostsQuery() {
    return this.postsRepo
      .createQueryBuilder('post')
      .leftJoin('post.likes', 'like')
      .leftJoin('post.author', 'author')
      .select('post.id', 'id')
      .addSelect('post.title', 'title')
      .addSelect('post.views', 'views')
      .addSelect('post.createdAt', 'createdAt')
      .addSelect('author.name', 'authorName')
      .addSelect('COUNT(like.id)', 'likes')
      .groupBy('post.id')
      .orderBy('likes', 'DESC');
  }

  private toChartRow(row: Record<string, unknown>) {
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
