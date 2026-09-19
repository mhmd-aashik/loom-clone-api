import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsIn(['PRIVATE', 'PUBLIC'])
  visibility?: 'PRIVATE' | 'PUBLIC';
}
