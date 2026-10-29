import { IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @IsNotEmpty()
  description: string;
}
