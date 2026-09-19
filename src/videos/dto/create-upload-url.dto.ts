import { IsIn, IsInt, Max, Min } from 'class-validator';

export class CreateUploadUrlDto {
  @IsIn(['video/webm', 'video/mp4'])
  contentType: 'video/webm' | 'video/mp4';

  @IsInt()
  @Min(1)
  @Max(500 * 1024 * 1024)
  sizeBytes: number;
}
