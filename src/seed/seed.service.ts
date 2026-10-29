import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Like } from '../entities/like.entity';
import { Post } from '../entities/post.entity';
import { User, UserRole } from '../entities/user.entity';

// Seeds demo users, posts and likes on first boot so the app
// (and the analytics dashboard) has data to show immediately.
@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Post) private postsRepo: Repository<Post>,
    @InjectRepository(Like) private likesRepo: Repository<Like>,
  ) {}

  async onModuleInit() {
    if ((await this.postsRepo.count()) > 0) {
      return; // already seeded
    }

    const password = await bcrypt.hash('user123', 10);
    const demoUsers = await this.usersRepo.save([
      { name: 'Alex Kumar', email: 'alex@connecthub.com', password, role: UserRole.USER },
      { name: 'Priya Sharma', email: 'priya@connecthub.com', password, role: UserRole.USER },
      { name: 'Rahul Dev', email: 'rahul@connecthub.com', password, role: UserRole.USER },
    ]);
    const [alex, priya, rahul] = demoUsers;

    const posts = await this.postsRepo.save([
      {
        title: 'Welcome to ConnectHub!',
        description:
          'Excited to join this community. Looking forward to sharing updates and learning from everyone here.',
        author: alex,
        views: 142,
      },
      {
        title: 'Tips for writing clean React components',
        description:
          'Keep components small, lift state only when needed, and prefer composition over prop drilling. A thread on what worked for our team.',
        author: priya,
        views: 387,
      },
      {
        title: 'Our journey migrating to NestJS',
        description:
          'We moved our Express API to NestJS over two sprints. Modules and dependency injection made the codebase far easier to navigate.',
        author: rahul,
        views: 256,
      },
      {
        title: 'Design systems save time',
        description:
          'Adopting a shared color and spacing scale cut our UI review time in half. Consistency beats creativity in enterprise apps.',
        author: alex,
        views: 198,
      },
      {
        title: 'MySQL indexing basics every dev should know',
        description:
          'A quick primer on when to add indexes, how composite indexes work, and reading EXPLAIN output without fear.',
        author: priya,
        views: 310,
      },
    ]);

    // Cross-likes between demo users
    const likePairs: Array<[User, Post]> = [
      [priya, posts[0]],
      [rahul, posts[0]],
      [alex, posts[1]],
      [rahul, posts[1]],
      [priya, posts[2]],
      [alex, posts[4]],
      [rahul, posts[3]],
    ];
    await this.likesRepo.save(
      likePairs.map(([user, post]) => this.likesRepo.create({ user, post })),
    );
  }
}
