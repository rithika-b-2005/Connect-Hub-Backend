import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  isStorageConfigured,
  limitsFor,
  objectKeyFor,
  presignUpload,
} from '../common/storage';
import { PresignMediaDto } from './dto/presign-media.dto';

/**
 * Hands out the URLs the browser uploads to.
 *
 * The file itself never comes here: the browser PUTs it straight to the
 * bucket, so the API does not have to buffer it, and the size limit is the
 * bucket's rather than this service's.
 */
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  /** Whether uploads are possible at all, so the UI can say so. */
  @Get('status')
  status() {
    return { configured: isStorageConfigured() };
  }

  @Post('presign')
  async presign(@Body() dto: PresignMediaDto) {
    if (!isStorageConfigured()) {
      throw new HttpException(
        'Media storage is not configured. Set S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_URL.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const { mimeTypes, maxSize } = limitsFor(dto.kind);

    if (!mimeTypes.includes(dto.contentType)) {
      throw new BadRequestException(
        `Unsupported file type: ${dto.contentType}. Allowed: ${mimeTypes.join(', ')}`,
      );
    }

    if (dto.size > maxSize) {
      throw new BadRequestException(
        `File is larger than the ${Math.round(maxSize / 1024 / 1024)} MB limit`,
      );
    }

    const key = objectKeyFor(dto.kind, dto.contentType);
    const { uploadUrl, publicUrl, headers } = await presignUpload(key, dto.contentType);

    return { key, uploadUrl, publicUrl, headers };
  }
}
