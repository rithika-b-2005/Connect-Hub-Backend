import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { UserRole } from '../common/enums';
import { publicUserSelect } from '../common/prisma-selects';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type Actor = { id: string; role: UserRole };

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // Seed a first admin so a fresh install is usable immediately.
  //
  // Not in production: a fixed default password on a live database is a
  // standing credential, and this service would recreate it after every
  // deletion. Outside production the password is random and printed once,
  // so it is never a known value.
  async onModuleInit() {
    if (this.config.get('NODE_ENV') === 'production') return;

    const email = 'admin@connecthub.com';
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) return;

    const password = randomBytes(9).toString('base64url');
    await this.prisma.user.create({
      data: {
        name: 'Admin',
        email,
        password: await bcrypt.hash(password, 10),
        role: UserRole.ADMIN,
      },
    });
    console.warn(
      `[seed] created admin "${email}" — password: ${password} (change it after signing in)`,
    );
  }

  findAll(search?: string, role?: UserRole) {
    return this.prisma.user.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {}),
        ...(role ? { role } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: publicUserSelect,
    });
  }

  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateMe(id: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...publicUserSelect, password: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('Current password is required');
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      // Changing the hash also invalidates every token issued for this
      // account — the token binding is derived from the hash.
      data.password = await bcrypt.hash(dto.newPassword, 10);
    }

    if (dto.name) {
      data.name = dto.name;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  }

  async setPhoto(
    id: string,
    field: 'avatarUrl' | 'coverUrl',
    file: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Replace, don't accumulate: remove the previous photo from disk
    const old = user[field];
    if (old) {
      await unlink(join(process.cwd(), old.replace(/^\//, ''))).catch(
        () => {},
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: { [field]: `/uploads/${file.filename}` },
      select: publicUserSelect,
    });
  }

  // --- admin operations ---

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateByAdmin(id: string, dto: UpdateUserDto, actor: Actor) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Changing your own role is how an admin locks themselves out.
    if (dto.role !== undefined && id === actor.id) {
      throw new BadRequestException('You cannot change your own role');
    }

    // Never demote the last admin — there would be nobody left to promote
    // anyone else, and the whole admin API would be unreachable.
    if (
      dto.role !== undefined &&
      dto.role !== user.role &&
      user.role === UserRole.ADMIN
    ) {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last remaining admin',
        );
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.role !== undefined) {
      data.role = dto.role;
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const generated = dto.newPassword ? undefined : randomBytes(9).toString('base64url');
    const password = dto.newPassword ?? generated!;

    await this.prisma.user.update({
      where: { id },
      data: { password: await bcrypt.hash(password, 10) },
    });

    // The new hash invalidates every token that account held.
    return {
      message: 'Password reset. The user must sign in again.',
      tempPassword: generated ?? null,
    };
  }

  async remove(id: string, actor: Actor) {
    // Deleting yourself removes the only way back into the admin API.
    if (id === actor.id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot delete the last remaining admin',
        );
      }
    }

    // The database cascades the rows; the files on disk do not — clean those
    // up ourselves while we still know what they are.
    const media = await this.prisma.postMedia.findMany({
      where: { post: { userId: id } },
      select: { filename: true },
    });
    await Promise.all([
      ...media.map((m) =>
        unlink(join(process.cwd(), 'uploads', m.filename)).catch(() => {}),
      ),
      ...[user.avatarUrl, user.coverUrl]
        .filter((u): u is string => !!u)
        .map((u) =>
          unlink(join(process.cwd(), u.replace(/^\//, ''))).catch(() => {}),
        ),
    ]);

    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
  }
}
