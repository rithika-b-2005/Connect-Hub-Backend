import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * A profile photo that was uploaded straight to the bucket.
 *
 * The client sends the key it got from the presign endpoint; the URL is
 * derived from it on the server.
 */
export class PhotoRefDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^profiles\/[a-f0-9]{32}\.[a-z0-9]+$/, {
    message: 'photo key is not a profile photo key',
  })
  key: string;
}
