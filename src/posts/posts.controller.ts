import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums';
import {
  deleteObject,
  isStorageConfigured,
  limitsFor,
  MEDIA_SIZE_LIMIT,
  objectKeyFor,
  uploadObject,
} from '../common/storage';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ModeratePostDto } from './dto/moderate-post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Get()
  findAll(@Request() req) {
    return this.postsService.findAll(req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.postsService.findOne(id, req.user);
  }

  // Users create content; admin is a moderator, not a publisher.
  // The body is JSON: title, description and the keys of the files that were
  // uploaded straight to Cloudinary. Multipart clients may also attach files
  // in the "media" field; those are buffered in memory and sent to Cloudinary.
  @Post()
  @Roles(UserRole.USER)
  @UseInterceptors(
    FilesInterceptor('media', 5, {
      storage: memoryStorage(),
      limits: { files: 5, fileSize: MEDIA_SIZE_LIMIT },
    }),
  )
  async create(
    @Body() dto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Request() req,
  ) {
    const uploadedKeys: string[] = [];
    const media = [...(dto.media ?? [])];

    if (files.length > 0) {
      if (!isStorageConfigured()) {
        throw new HttpException(
          'Media storage is not configured.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const { mimeTypes } = limitsFor('media');
      for (const file of files) {
        if (!mimeTypes.includes(file.mimetype)) {
          throw new BadRequestException(
            `Unsupported file type: ${file.mimetype}`,
          );
        }
      }
    }

    try {
      for (const file of files) {
        const key = objectKeyFor('media', file.mimetype);
        await uploadObject(key, file.mimetype, file.buffer);
        uploadedKeys.push(key);
        media.push({ key });
      }

      return await this.postsService.create({ ...dto, media }, req.user);
    } catch (error) {
      await Promise.all(uploadedKeys.map((key) => deleteObject(key)));
      throw error;
    }
  }

  @Post(':id/like')
  @Roles(UserRole.USER)
  toggleLike(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.postsService.toggleLike(id, req.user);
  }

  @Post(':id/comments')
  @Roles(UserRole.USER)
  createComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
    @Request() req,
  ) {
    return this.postsService.createComment(id, dto.content, req.user);
  }

  @Patch(':id/moderation')
  @Roles(UserRole.ADMIN)
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModeratePostDto,
  ) {
    return this.postsService.moderate(id, dto.status, dto.reason);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.postsService.remove(id, req.user);
  }
}
