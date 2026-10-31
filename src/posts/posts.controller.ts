import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums';
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
  // uploaded straight to the bucket. The files never pass through this
  // service.
  @Post()
  @Roles(UserRole.USER)
  create(@Body() dto: CreatePostDto, @Request() req) {
    return this.postsService.create(dto, req.user);
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
