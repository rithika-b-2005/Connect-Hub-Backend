import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Comment cannot be empty' })
  @MaxLength(2000)
  content: string;
}
