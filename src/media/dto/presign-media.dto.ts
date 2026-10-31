import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export class PresignMediaDto {
  /** What the file is for. It decides the size limit and the key folder. */
  @IsString()
  @IsIn(['media', 'avatar', 'cover'])
  kind: 'media' | 'avatar' | 'cover';

  @IsString()
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(200 * 1024 * 1024)
  size: number;
}
