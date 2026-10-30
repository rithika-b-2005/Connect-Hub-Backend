import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums';
import { credentialUserSelect } from '../common/prisma-selects';
import { signTokenBinding } from '../common/token-binding';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

type TokenUser = {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatarUrl: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException('Email already registered');
    }

    console.log('Signing up user:', dto.email); // Debugging log
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: UserRole.USER,
      },
      select: credentialUserSelect,
    });

    return this.buildToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: credentialUserSelect,
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildToken(user);
  }

  private buildToken(user: TokenUser) {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');

    // The token is bound to the account's current credential state. If the
    // password is changed or the role changes, this binding stops matching
    // and the strategy rejects the token.
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ver: signTokenBinding(secret, user.password, user.role),
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
      },
    };
  }
}
