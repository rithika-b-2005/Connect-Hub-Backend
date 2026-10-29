import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  // Seed a default admin on first boot so the app is usable immediately
  async onModuleInit() {
    const admin = await this.usersRepo.findOne({
      where: { email: 'admin@connecthub.com' },
    });
    if (!admin) {
      await this.usersRepo.save(
        this.usersRepo.create({
          name: 'Admin',
          email: 'admin@connecthub.com',
          password: await bcrypt.hash('admin123', 10),
          role: UserRole.ADMIN,
        }),
      );
    }
  }

  findAll(search?: string, role?: UserRole) {
    const query = this.usersRepo.createQueryBuilder('user');

    if (search) {
      query.where('user.name LIKE :search OR user.email LIKE :search', {
        search: `%${search}%`,
      });
    }
    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    return query.orderBy('user.createdAt', 'DESC').getMany();
  }

  async getMe(id: number) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateMe(id: number, dto: UpdateProfileDto) {
    const user = await this.usersRepo.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'password', 'role', 'createdAt'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('Current password is required');
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      user.password = await bcrypt.hash(dto.newPassword, 10);
    }

    if (dto.name) {
      user.name = dto.name;
    }

    const saved = await this.usersRepo.save(user);
    return {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      role: saved.role,
      createdAt: saved.createdAt,
    };
  }

  async updateRole(id: number, role: UserRole) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.role = role;
    return this.usersRepo.save(user);
  }

  async remove(id: number) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepo.remove(user);
    return { message: 'User deleted' };
  }
}
