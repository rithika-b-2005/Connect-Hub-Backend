import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PostStatus } from '../../generated/prisma/client';

export class ModeratePostDto {
  @IsEnum(PostStatus)
  status: PostStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
