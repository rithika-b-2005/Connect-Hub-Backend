import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Like } from '../entities/like.entity';
import { Post } from '../entities/post.entity';
import { UserRole } from '../entities/user.entity';
import { CreatePostDto } from './dto/create-post.dto';

type AuthUser = { id: number; role: UserRole };

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private postsRepo: Repository<Post>,
    @InjectRepository(Like) private likesRepo: Repository<Like>,
  ) {}

  async findAll(me: AuthUser) {
    const posts = await this.postsRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['likes', 'likes.user'],
    });

    // Viewing the feed counts as an impression on everyone else's posts
    const viewedIds = posts
      .filter((p) => p.author.id !== me.id)
      .map((p) => p.id);
    if (viewedIds.length > 0) {
      await this.postsRepo.increment({ id: In(viewedIds) }, 'views', 1);
    }

    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      views: p.views + (p.author.id !== me.id ? 1 : 0),
      createdAt: p.createdAt,
      author: { id: p.author.id, name: p.author.name, role: p.author.role },
      likeCount: p.likes.length,
      likedByMe: p.likes.some((l) => l.user.id === me.id),
      isMine: p.author.id === me.id,
    }));
  }

  async create(dto: CreatePostDto, me: AuthUser) {
    const post = this.postsRepo.create({
      title: dto.title,
      description: dto.description,
      author: { id: me.id } as never,
    });
    return this.postsRepo.save(post);
  }

  async toggleLike(postId: number, me: AuthUser) {
    const post = await this.postsRepo.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.likesRepo.findOne({
      where: { post: { id: postId }, user: { id: me.id } },
    });

    if (existing) {
      await this.likesRepo.remove(existing);
    } else {
      await this.likesRepo.save(
        this.likesRepo.create({
          post: { id: postId } as never,
          user: { id: me.id } as never,
        }),
      );
    }

    const likeCount = await this.likesRepo.count({
      where: { post: { id: postId } },
    });
    return { liked: !existing, likeCount };
  }

  async remove(postId: number, me: AuthUser) {
    const post = await this.postsRepo.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Owner can delete own post; admin can moderate any post
    if (post.author.id !== me.id && me.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.postsRepo.remove(post);
    return { message: 'Post deleted' };
  }
}
