import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { verifyTokenBinding } from '../common/token-binding';
import { PrismaService } from '../prisma/prisma.service';

type TokenPayload = {
  sub: string;
  email: string;
  role: string;
  ver?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly prisma: PrismaService;
  private readonly config: ConfigService;

  constructor(config: ConfigService, prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
    this.config = config;
    this.prisma = prisma;
  }

  // Runs after the signature check. The account is looked up on every request
  // so that a deleted user, a demoted admin or a changed password invalidates
  // tokens that were already issued — a stateless JWT cannot know any of that
  // on its own. The role comes from the database, never from the token.
  async validate(payload: TokenPayload) {
    if (typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Session expired, sign in again');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, password: true },
    });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    if (
      !verifyTokenBinding(secret, user.password, user.role, payload.ver)
    ) {
      throw new UnauthorizedException('Session expired, sign in again');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
