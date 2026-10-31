/**
 * Cloudinary media storage. Browser uploads use short-lived signed parameters,
 * while multipart API clients are streamed to Cloudinary from memory.
 */

import { randomBytes } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import {
  EXT_BY_MIME,
  IMAGE_MIME_TYPES,
  MEDIA_MIME_TYPES,
} from './upload.config';

export type StorageKind = 'media' | 'avatar' | 'cover';

export const MEDIA_SIZE_LIMIT = 50 * 1024 * 1024;
export const IMAGE_SIZE_LIMIT = 8 * 1024 * 1024;

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function getCloudinaryConfig(): CloudinaryConfig | null {
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = process.env;
  return cloudName && apiKey && apiSecret
    ? { cloudName, apiKey, apiSecret }
    : null;
}

export function isStorageConfigured(): boolean {
  return getCloudinaryConfig() !== null;
}

function configureCloudinary(): CloudinaryConfig {
  const config = getCloudinaryConfig();
  if (!config) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
    );
  }

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
  return config;
}

/** Which MIME types and how large a file may be for this kind of upload. */
export function limitsFor(kind: StorageKind) {
  return kind === 'media'
    ? { mimeTypes: MEDIA_MIME_TYPES, maxSize: MEDIA_SIZE_LIMIT }
    : { mimeTypes: IMAGE_MIME_TYPES, maxSize: IMAGE_SIZE_LIMIT };
}

/** Build a non-guessable public ID with a validated file extension. */
export function objectKeyFor(kind: StorageKind, mimeType: string): string {
  const folder = kind === 'media' ? 'posts' : 'profiles';
  return `${folder}/${randomBytes(16).toString('hex')}${EXT_BY_MIME[mimeType] ?? ''}`;
}

function publicIdFor(key: string): string {
  return key.replace(/\.[a-z0-9]+$/i, '');
}

function resourceTypeForKey(key: string): 'image' | 'video' {
  return key.toLowerCase().endsWith('.mp4') ||
    key.toLowerCase().endsWith('.webm') ||
    key.toLowerCase().endsWith('.mov')
    ? 'video'
    : 'image';
}

/** Return the secure Cloudinary delivery URL for a stored media key. */
export function publicUrlFor(key: string): string {
  configureCloudinary();
  const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return cloudinary.url(publicIdFor(key), {
    resource_type: resourceTypeForKey(key),
    format: extension,
    secure: true,
  });
}

/** Extract one of our stored keys from a Cloudinary delivery URL. */
export function keyFromUrl(value: string): string | null {
  const config = getCloudinaryConfig();
  if (!value || !config) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.hostname !== 'res.cloudinary.com') return null;

  const segments = url.pathname.split('/').filter(Boolean);
  if (
    segments[0] !== config.cloudName ||
    !['image', 'video'].includes(segments[1]) ||
    segments[2] !== 'upload'
  ) {
    return null;
  }

  const assetSegments = segments.slice(3);
  if (assetSegments[0]?.match(/^v\d+$/)) assetSegments.shift();
  const key = assetSegments.join('/');
  return /^(posts|profiles)\/[a-f0-9]{32}\.[a-z0-9]+$/i.test(key) ? key : null;
}

/** The MIME type of a stored key, derived from its server-selected extension. */
export function mimeTypeForKey(key: string): string {
  const extension = key.slice(key.lastIndexOf('.')).toLowerCase();
  return (
    Object.entries(EXT_BY_MIME).find(([, ext]) => ext === extension)?.[0] ??
    'application/octet-stream'
  );
}

/** Create signed browser upload parameters without exposing the API secret. */
export async function presignUpload(key: string): Promise<{
  uploadUrl: string;
  publicUrl: string;
  fields: Record<string, string>;
}> {
  const config = configureCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = publicIdFor(key);
  const uploadOptions = { overwrite: false, public_id: publicId, timestamp };
  const signature = cloudinary.utils.api_sign_request(
    uploadOptions,
    config.apiSecret,
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`,
    publicUrl: publicUrlFor(key),
    fields: {
      api_key: config.apiKey,
      overwrite: 'false',
      public_id: publicId,
      timestamp: String(timestamp),
      signature,
    },
  };
}

/** Upload a buffered file to Cloudinary without writing it to local disk. */
export async function uploadObject(
  key: string,
  contentType: string,
  body: Buffer,
): Promise<void> {
  configureCloudinary();
  const resourceType = contentType.startsWith('video/') ? 'video' : 'image';

  await new Promise<void>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicIdFor(key),
        resource_type: resourceType,
        overwrite: false,
        invalidate: true,
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
    stream.end(body);
  });
}

/** Remove a Cloudinary asset. Cloudinary treats a missing asset as a no-op. */
export async function deleteObject(key: string): Promise<void> {
  if (!isStorageConfigured() || !key) return;
  configureCloudinary();
  await cloudinary.uploader.destroy(publicIdFor(key), {
    resource_type: resourceTypeForKey(key),
    invalidate: true,
  });
}
