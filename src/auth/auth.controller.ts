import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // Tighter than the global limit: this is the endpoint an attacker would
  // brute-force. It still has to leave room for real people — several people
  // behind one NAT share an IP, and anyone who mistypes a password retries —
  // so the ceiling is one attempt every few seconds rather than a handful
  // per minute.
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // JWT is stateless — logout just confirms; client deletes the token.
  // Changing the password is what actually invalidates issued tokens.
  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout() {
    return { message: 'Logged out successfully' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@Request() req) {
    return req.user;
  }
}
