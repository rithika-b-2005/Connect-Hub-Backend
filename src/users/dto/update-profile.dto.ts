import { IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNotEmpty()
  currentPassword?: string;

  @IsOptional()
  @MinLength(6)
  newPassword?: string;
}
