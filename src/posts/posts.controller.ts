import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { ModeratePostDto } from './dto/moderate-post.dto';
import { MAX_MEDIA_FILES, mediaUploadOptions } from '../common/upload.config';
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
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.postsService.findOne(id, req.user);
  }

  // Users create content; admin is a moderator, not a publisher.
  // Accepts multipart/form-data: title, description + up to 5 "media" files
  @Post()
  @Roles(UserRole.USER)
  @UseInterceptors(
    FilesInterceptor('media', MAX_MEDIA_FILES, mediaUploadOptions),
  )
  create(
    @Body() dto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    return this.postsService.create(dto, files ?? [], req.user);
  }

  @Post(':id/like')
  @Roles(UserRole.USER)
  toggleLike(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.postsService.toggleLike(id, req.user);
  }

  @Post(':id/comments')
  @Roles(UserRole.USER)
  createComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto,
    @Request() req,
  ) {
    return this.postsService.createComment(id, dto.content, req.user);
  }

  @Patch(':id/moderation')
  @Roles(UserRole.ADMIN)
  moderate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModeratePostDto,
  ) {
    return this.postsService.moderate(id, dto.status, dto.reason);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.postsService.remove(id, req.user);
  }
}
