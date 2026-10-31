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
 * The API signs upload parameters while the browser sends the file directly
 * to Cloudinary.
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
        'Media storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
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
    const { uploadUrl, publicUrl, fields } = await presignUpload(key);

    return { key, uploadUrl, publicUrl, fields };
  }
}
