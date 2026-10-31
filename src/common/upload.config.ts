/**
 * What may be uploaded, and what the stored file is called.
 *
 * The rules live here because both sides need them: the presign endpoint
 * checks a request against them, and the object key is built from the MIME
 * type that was accepted.
 */

/**
 * The stored extension is derived from the MIME type we validated, never from
 * the client-supplied filename.
 *
 * Both the Content-Type and the filename come from the client, so validating
 * one and trusting the other let an attacker store `evil.svg` (or .html)
 * behind an `image/png` Content-Type. The static file server then hands it
 * back as active content from our own origin.
 */
export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export const MEDIA_MIME_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES];

export function isVideoMimeType(mimeType: string): boolean {
  return VIDEO_MIME_TYPES.includes(mimeType);
}
