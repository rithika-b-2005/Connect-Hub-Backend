import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

/**
 * A file that was uploaded straight to the bucket.
 *
 * The client sends the key it got from the presign endpoint. The URL, the type
 * and the MIME type are derived from the key on the server, so a client
 * cannot make the app render an arbitrary address as if it were our own
 * media.
 */
export class MediaRefDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^posts\/[a-f0-9]{32}\.[a-z0-9]+$/, {
    message: 'media key is not a post media key',
  })
  key: string;
}

export class CreatePostDto {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MediaRefDto)
  media?: MediaRefDto[];
}
