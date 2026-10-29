import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../entities/user.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Get()
  findAll(@Request() req) {
    return this.postsService.findAll(req.user);
  }

  // Users create content; admin is a moderator, not a publisher
  @Post()
  @Roles(UserRole.USER)
  create(@Body() dto: CreatePostDto, @Request() req) {
    return this.postsService.create(dto, req.user);
  }

  @Post(':id/like')
  @Roles(UserRole.USER)
  toggleLike(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.postsService.toggleLike(id, req.user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.postsService.remove(id, req.user);
  }
}
