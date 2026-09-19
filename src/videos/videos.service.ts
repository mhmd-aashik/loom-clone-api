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
import { eq, desc, and } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class VideosService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,

    @InjectQueue('video-processing')
    private readonly videoQueue: Queue,
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

    await this.videoQueue.add(
      'process-video',
      {
        videoId: updatedVideo.id,
        userId: updatedVideo.ownerId,
        storageKey: updatedVideo.storageKey,
      },
      {
        attempts: 3,

        backoff: {
          type: 'exponential',
          delay: 5000,
        },

        removeOnComplete: true,

        removeOnFail: 100,
      },
    );

    return updatedVideo;
  }

  async getMyVideos(userId: string) {
    return this.databaseService.db
      .select({
        id: videos.id,
        title: videos.title,
        status: videos.status,
        visibility: videos.visibility,
        durationSeconds: videos.durationSeconds,
        sizeBytes: videos.sizeBytes,
        mimeType: videos.mimeType,
        createdAt: videos.createdAt,
        updatedAt: videos.updatedAt,
      })
      .from(videos)
      .where(eq(videos.ownerId, userId))
      .orderBy(desc(videos.createdAt));
  }

  async getVideo(userId: string, videoId: string) {
    const [video] = await this.databaseService.db
      .select({
        id: videos.id,
        title: videos.title,
        status: videos.status,
        visibility: videos.visibility,
        durationSeconds: videos.durationSeconds,
        sizeBytes: videos.sizeBytes,
        mimeType: videos.mimeType,
        createdAt: videos.createdAt,
        updatedAt: videos.updatedAt,
      })
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.ownerId, userId)))
      .limit(1);

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return video;
  }

  async getPlaybackUrl(userId: string, videoId: string) {
    const [video] = await this.databaseService.db
      .select({
        id: videos.id,
        status: videos.status,
        processedStorageKey: videos.processedStorageKey,
      })
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.ownerId, userId)))
      .limit(1);

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    if (video.status !== 'READY' || !video.processedStorageKey) {
      throw new BadRequestException('Video is not ready for playback');
    }

    const playbackUrl = await this.storageService.createDownloadUrl(
      video.processedStorageKey,
    );

    return {
      playbackUrl,
      expiresIn: 900,
    };
  }
}
