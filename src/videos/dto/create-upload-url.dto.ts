import { IsIn, IsString } from 'class-validator';

export class CreateUploadUrlDto {
  @IsString()
  @IsIn(['video/webm', 'video/mp4'])
  contentType: 'video/webm' | 'video/mp4';
}
