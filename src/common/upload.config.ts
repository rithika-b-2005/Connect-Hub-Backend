import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomBytes } from 'crypto';
import { diskStorage } from 'multer';

export const MAX_MEDIA_FILES = 5;

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// The stored extension is derived from the MIME type we validated, never
// from the client-supplied filename.
//
// Both the Content-Type and the filename come from the client, so validating
// one and trusting the other let an attacker store `evil.svg` (or .html)
// behind an `image/png` Content-Type. The static file server then hands it
// back as active content from our own origin.
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const storage = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    // Never trust the client filename; the fileFilter has already rejected
    // anything whose MIME type is not in the map.
    cb(null, `${randomBytes(16).toString('hex')}${EXT_BY_MIME[file.mimetype] ?? ''}`);
  },
});

const fileFilterFor =
  (allowed: string[], label: string): MulterOptions['fileFilter'] =>
  (_req, file, cb) => {
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          `Unsupported file type: ${file.mimetype}. Allowed: ${label}`,
        ),
        false,
      );
    }
  };

// Post attachments: images + videos
export const mediaUploadOptions: MulterOptions = {
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: fileFilterFor(
    [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES],
    'images (jpeg, png, gif, webp) and videos (mp4, webm, mov)',
  ),
};

// Profile photos: images only
export const imageUploadOptions: MulterOptions = {
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: fileFilterFor(
    IMAGE_MIME_TYPES,
    'images (jpeg, png, gif, webp)',
  ),
};
