import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../common/enums';
import { imageUploadOptions } from '../common/upload.config';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Own profile — open to every logged-in role, overrides class-level admin rule
  @Get('me')
  @Roles(UserRole.ADMIN, UserRole.USER)
  getMe(@Request() req) {
    return this.usersService.getMe(req.user.id);
  }

  @Patch('me')
  @Roles(UserRole.ADMIN, UserRole.USER)
  updateMe(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(req.user.id, dto);
  }

  // Profile photos — multipart/form-data with single "file" field
  @Post('me/avatar')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadAvatar(@Request() req, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.usersService.setPhoto(req.user.id, 'avatarUrl', file);
  }

  @Post('me/cover')
  @Roles(UserRole.ADMIN, UserRole.USER)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadCover(@Request() req, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.usersService.setPhoto(req.user.id, 'coverUrl', file);
  }

  @Get()
  findAll(@Query('search') search?: string, @Query('role') role?: UserRole) {
    return this.usersService.findAll(search, role);
  }

  // --- admin operations on another account ---
  // Declared after the "me" routes above so /users/me still resolves to the
  // signed-in user's own profile.

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Request() req,
  ) {
    return this.usersService.updateByAdmin(id, dto, req.user);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.usersService.remove(id, req.user);
  }
}
