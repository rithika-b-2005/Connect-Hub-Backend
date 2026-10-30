import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { MediaType, UserRole } from '../common/enums';
import { PostStatus } from '../generated/prisma/client';
import { likerIdSelect } from '../common/prisma-selects';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

type AuthUser = { id: number; role: UserRole };

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async findAll(me: AuthUser) {
    const posts = await this.prisma.post.findMany({
      where:
        me.role === UserRole.ADMIN
          ? {}
          : {
              OR: [{ status: { not: PostStatus.hidden } }, { authorId: me.id }],
            },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
        media: { select: { id: true, url: true, type: true } },
        likes: { select: { user: { select: likerIdSelect } } },
        _count: { select: { comments: true } },
      },
    });

    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      views: p.views,
      createdAt: p.createdAt,
      author: {
        id: p.author?.id ?? 0,
        name: p.author?.name ?? 'Unknown',
        role: p.author?.role ?? UserRole.USER,
        avatarUrl: p.author?.avatarUrl ?? null,
      },
      likeCount: p.likes.length,
      commentCount: p._count.comments,
      likedByMe: p.likes.some((l) => l.user?.id === me.id),
      isMine: p.author?.id === me.id,
      status: p.status,
      moderationReason:
        p.author?.id === me.id || me.role === UserRole.ADMIN
          ? p.moderationReason
          : null,
      media: p.media.map((m) => ({ id: m.id, url: m.url, type: m.type })),
    }));
  }

  async findOne(postId: number, me: AuthUser) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
        media: { select: { id: true, url: true, type: true } },
        likes: {
          select: {
            createdAt: true,
            user: { select: likerIdSelect },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (
      post.status === PostStatus.hidden &&
      post.author?.id !== me.id &&
      me.role !== UserRole.ADMIN
    ) {
      throw new NotFoundException('Post not found');
    }

    const views =
      post.author?.id === me.id || post.status === PostStatus.hidden
        ? post.views
        : await this.prisma.$transaction(async (tx) => {
            const result = await tx.postView.createMany({
              data: [{ postId, userId: me.id }],
              skipDuplicates: true,
            });
            if (result.count === 0) {
              const current = await tx.post.findUniqueOrThrow({
                where: { id: postId },
                select: { views: true },
              });
              return current.views;
            }

            const updated = await tx.post.update({
              where: { id: postId },
              data: { views: { increment: 1 } },
              select: { views: true },
            });
            return updated.views;
          });

    return {
      id: post.id,
      title: post.title,
      description: post.description,
      views,
      createdAt: post.createdAt,
      author: {
        id: post.author?.id ?? 0,
        name: post.author?.name ?? 'Unknown',
        role: post.author?.role ?? UserRole.USER,
        avatarUrl: post.author?.avatarUrl ?? null,
      },
      media: post.media,
      likeCount: post.likes.length,
      likedByMe: post.likes.some((like) => like.user?.id === me.id),
      likes: post.likes.map((like) => ({
        userId: like.user?.id ?? null,
        createdAt: like.createdAt,
      })),
      comments: post.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        author: comment.user,
      })),
      status: post.status,
      moderationReason:
        post.author?.id === me.id || me.role === UserRole.ADMIN
          ? post.moderationReason
          : null,
    };
  }

  async createComment(postId: number, content: string, me: AuthUser) {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      throw new BadRequestException('Comment cannot be empty');
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.status !== PostStatus.active) {
      throw new ForbiddenException('Comments are disabled for this post');
    }

    return this.prisma.comment.create({
      data: {
        content: normalizedContent,
        post: { connect: { id: postId } },
        user: { connect: { id: me.id } },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async create(dto: CreatePostDto, files: Express.Multer.File[], me: AuthUser) {
    return this.prisma.post.create({
      data: {
        title: dto.title,
        description: dto.description,
        author: { connect: { id: me.id } },
        // TypeORM's `cascade: true` on the media relation becomes a nested
        // create — the media rows are written in the same transaction.
        media: {
          create: files.map((f) => ({
            filename: f.filename,
            url: `/uploads/${f.filename}`,
            type: f.mimetype.startsWith('video/')
              ? MediaType.VIDEO
              : MediaType.IMAGE,
            mimeType: f.mimetype,
          })),
        },
      },
    });
  }

  async toggleLike(postId: number, me: AuthUser) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.status !== PostStatus.active) {
      throw new ForbiddenException('Likes are disabled for this post');
    }

    const existing = await this.prisma.like.findUnique({
      where: { userId_postId: { userId: me.id, postId } },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.like.delete({ where: { id: existing.id } });
    } else {
      try {
        await this.prisma.like.create({ data: { userId: me.id, postId } });
      } catch (e) {
        // Two concurrent likes on the same post: the unique constraint caught
        // the loser. Treat it as a successful like rather than a 500.
        const isDuplicate =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002';
        if (!isDuplicate) throw e;
      }
    }

    const likeCount = await this.prisma.like.count({ where: { postId } });
    return { liked: !existing, likeCount };
  }

  async moderate(
    postId: number,
    status: PostStatus,
    reason: string | undefined,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, title: true, authorId: true, status: true },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const normalizedReason = reason?.trim();
    if (status !== PostStatus.active && !normalizedReason) {
      throw new BadRequestException(
        'A reason is required to restrict or hide a post',
      );
    }
    if (post.status === status) {
      throw new BadRequestException('Post already has this moderation status');
    }

    const message =
      status === PostStatus.active
        ? `Your post "${post.title}" has been restored and is visible again.`
        : status === PostStatus.hidden
          ? `Your post "${post.title}" was hidden. Reason: ${normalizedReason}`
          : `Your post "${post.title}" was restricted. Likes and comments are disabled. Reason: ${normalizedReason}`;
    const type =
      status === PostStatus.active ? 'post_restored' : `post_${status}`;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id: postId },
        data: {
          status,
          moderationReason:
            status === PostStatus.active ? null : normalizedReason,
          moderatedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          moderationReason: true,
          moderatedAt: true,
        },
      });

      if (post.authorId !== null) {
        await tx.notification.create({
          data: {
            userId: post.authorId,
            postId,
            type,
            message,
          },
        });
      }

      return updated;
    });
  }

  async remove(postId: number, me: AuthUser) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true } },
        media: { select: { filename: true } },
      },
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Owner can delete own post; admin can moderate any post
    if (post.author?.id !== me.id || me.role === UserRole.ADMIN) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.post.delete({ where: { id: postId } });

    // DB rows cascade; files on disk don't — clean them up ourselves
    await Promise.all(
      post.media.map((m) =>
        unlink(join(process.cwd(), 'uploads', m.filename)).catch(() => {}),
      ),
    );

    return { message: 'Post deleted' };
  }
}
