import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trusted origins out of the box: the deployed frontend, plus the Vite dev
  // server (5173) and the Vite preview server (4173) used by the Playwright
  // suite. Without the local entries the browser blocks every API call made
  // from a dev machine, because the browser enforces CORS even when the
  // request itself is fine.
  const defaultOrigins = [
    'https://connect-hub-frontend-1.onrender.com',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
  ];

  const allowedOrigins = (process.env.CORS_ORIGINS ?? defaultOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins });
  // Media is served from Cloudinary, not from here: this service never holds
  // the bytes, so there is no directory to expose and no file to lose when the
  // service is redeployed.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  // Required so PrismaService.onModuleDestroy runs $disconnect() on SIGTERM
  // and the connection pool is not leaked on shutdown.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
  console.log(`API running on http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
