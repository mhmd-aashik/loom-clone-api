import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { videos } from '../database/schemas';
import { CreateVideoDto } from './dto/create-video.dto';
import { StorageService } from '../storage/storage.service';
import { eq } from 'drizzle-orm';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class VideosService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  async create(userId: string, dto: CreateVideoDto) {
    const [video] = await this.databaseService.db
      .insert(videos)
      .values({
        ownerId: userId,
        title: dto.title.trim(),
        visibility: dto.visibility ?? 'PRIVATE',
        status: 'UPLOADING',
      })
      .returning();

    return video;
  }

  async createUploadUrl(
    userId: string,
    videoId: string,
    contentType: 'video/webm' | 'video/mp4',
  ) {
    // Find the video.
    const [video] = await this.databaseService.db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Ownership check.
    if (video.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this video');
    }

    const extension = contentType === 'video/mp4' ? 'mp4' : 'webm';

    const storageKey = `videos/${userId}/${video.id}/original.${extension}`;

    const uploadUrl = await this.storageService.createUploadUrl(
      storageKey,
      contentType,
    );

    // Save where this video's original file lives.
    await this.databaseService.db
      .update(videos)
      .set({
        storageKey,
        mimeType: contentType,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, video.id));

    return {
      uploadUrl,
      storageKey,
    };
  }

  async completeUpload(userId: string, videoId: string) {
    const [video] = await this.databaseService.db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this video');
    }

    if (!video.storageKey) {
      throw new BadRequestException('Video upload has not been initialized');
    }

    // Ask Railway Storage whether the object
    // actually exists.
    let metadata: {
      sizeBytes?: number;
      contentType?: string;
    };

    try {
      metadata = await this.storageService.getObjectMetadata(video.storageKey);
    } catch {
      throw new BadRequestException('Uploaded video was not found in storage');
    }

    const [updatedVideo] = await this.databaseService.db
      .update(videos)
      .set({
        status: 'PROCESSING',

        sizeBytes: metadata.sizeBytes ?? null,

        mimeType: metadata.contentType ?? video.mimeType,

        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId))
      .returning();

    return updatedVideo;
  }
}
