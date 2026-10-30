import { IsOptional, MinLength } from 'class-validator';

export class ResetPasswordDto {
  // Omit this and the API generates a strong password and returns it once.
  @IsOptional()
  @MinLength(6)
  newPassword?: string;
}
