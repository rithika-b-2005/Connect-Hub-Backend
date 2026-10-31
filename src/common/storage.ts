/**
 * Media storage in an S3-compatible bucket (Cloudflare R2, Backblaze B2, AWS
 * S3).
 *
 * The bytes never touch this service. The browser asks for a presigned URL,
 * PUTs the file straight to the bucket, and only tells us the key. That keeps
 * uploads off the API's disk — which on Render is wiped on every deploy — and
 * keeps large videos out of the request body, where the CDN in front of this
 * service would cap them.
 */

import { randomBytes } from 'crypto';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EXT_BY_MIME, MEDIA_MIME_TYPES, IMAGE_MIME_TYPES } from './upload.config';

export type StorageKind = 'media' | 'avatar' | 'cover';

export const MEDIA_SIZE_LIMIT = 50 * 1024 * 1024;
export const IMAGE_SIZE_LIMIT = 8 * 1024 * 1024;

const config = {
  endpoint: process.env.S3_ENDPOINT?.replace(/\/+$/, ''),
  region: process.env.S3_REGION || 'auto',
  bucket: process.env.S3_BUCKET,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  // The base the bucket is served from, without a trailing slash. For R2 that
  // is the r2.dev domain including the bucket name:
  // https://pub-<hash>.r2.dev/connect-hub-media
  publicUrl: (process.env.S3_PUBLIC_URL || '').replace(/\/+$/, ''),
};

export function isStorageConfigured(): boolean {
  return Boolean(
    config.endpoint &&
      config.bucket &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.publicUrl,
  );
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId as string,
        secretAccessKey: config.secretAccessKey as string,
      },
    });
  }
  return client;
}

/** Which MIME types and how large a file may be for this kind of upload. */
export function limitsFor(kind: StorageKind) {
  if (kind === 'media') {
    return { mimeTypes: MEDIA_MIME_TYPES, maxSize: MEDIA_SIZE_LIMIT };
  }
  return { mimeTypes: IMAGE_MIME_TYPES, maxSize: IMAGE_SIZE_LIMIT };
}

/**
 * The object key. The extension comes from the MIME type the upload was
 * validated against, never from the name the client sent, so an upload cannot
 * end up as something the browser would run.
 */
export function objectKeyFor(kind: StorageKind, mimeType: string): string {
  const folder = kind === 'media' ? 'posts' : 'profiles';
  return `${folder}/${randomBytes(16).toString('hex')}${EXT_BY_MIME[mimeType] ?? ''}`;
}

/** The public URL of an object. */
export function publicUrlFor(key: string): string {
  return `${config.publicUrl}/${key}`;
}

/**
 * The key behind a public URL. Used to delete an object when the row that
 * referenced it is deleted.
 */
export function keyFromUrl(url: string): string | null {
  if (!url) return null;
  const base = `${config.publicUrl}/`;
  if (!url.startsWith(base)) return null;
  return url.slice(base.length);
}

/** The MIME type an object key was stored with, read back from its extension. */
export function mimeTypeForKey(key: string): string {
  const extension = key.slice(key.lastIndexOf('.')).toLowerCase();
  const found = Object.entries(EXT_BY_MIME).find(([, ext]) => ext === extension);
  return found ? found[0] : 'application/octet-stream';
}

/**
 * A presigned PUT the browser can upload to. The content type is part of the
 * signature, so the browser has to send exactly this header.
 */
export async function presignUpload(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string; headers: Record<string, string> }> {
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: 900 });

  return {
    uploadUrl,
    publicUrl: publicUrlFor(key),
    headers: { 'Content-Type': contentType },
  };
}

/** Remove an object. A missing object is not an error. */
export async function deleteObject(key: string): Promise<void> {
  if (!isStorageConfigured() || !key) return;
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
    );
  } catch {
    // The row is gone either way; a leftover object is a housekeeping problem,
    // not a reason to fail the request that deleted the row.
  }
}
