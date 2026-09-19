import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';

import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import { StorageService } from '../../storage/storage.service';
import { DatabaseService } from '../../database/database.service';
import { eq } from 'drizzle-orm';
import { videos } from '../../database/schemas';

const execFileAsync = promisify(execFile);

interface ProcessVideoJob {
  videoId: string;
  userId: string;
  storageKey: string;
}

@Processor('video-processing')
export class VideoProcessor extends WorkerHost {
  constructor(
    private readonly storageService: StorageService,
    private readonly databaseService: DatabaseService,
  ) {
    super();
  }

  async process(job: Job<ProcessVideoJob>): Promise<void> {
    const { videoId, userId, storageKey } = job.data;

    const workDirectory = join(tmpdir(), 'loom-video-processing', videoId);

    // Determine the original file extension.
    const extension = storageKey.endsWith('.mp4') ? 'mp4' : 'webm';

    const inputPath = join(workDirectory, `original.${extension}`);

    const outputPath = join(workDirectory, 'processed.mp4');

    const thumbnailPath = join(workDirectory, 'thumbnail.jpg');

    try {
      // ----------------------------------------
      // 1. Create temporary working directory
      // ----------------------------------------

      await mkdir(workDirectory, {
        recursive: true,
      });

      console.log(`Processing video: ${videoId}`);

      // ----------------------------------------
      // 2. Download original from Railway
      // ----------------------------------------

      const originalVideo =
        await this.storageService.downloadObject(storageKey);

      // ----------------------------------------
      // 3. Save original temporarily
      // ----------------------------------------

      await writeFile(inputPath, originalVideo);

      console.log(`Original video downloaded: ${videoId}`);

      // ----------------------------------------
      // 4. Convert video using FFmpeg
      // ----------------------------------------

      await execFileAsync('ffmpeg', [
        '-y',

        '-i',
        inputPath,

        // H.264 video
        '-c:v',
        'libx264',

        // Good balance between speed/file size
        '-preset',
        'fast',

        // Video quality
        '-crf',
        '23',

        // AAC audio
        '-c:a',
        'aac',

        // Allows browser playback to start
        // before the whole MP4 downloads.
        '-movflags',
        '+faststart',

        outputPath,
      ]);

      console.log(`Video converted: ${videoId}`);

      // ----------------------------------------
      // 5. Generate thumbnail
      // ----------------------------------------

      await execFileAsync('ffmpeg', [
        '-y',

        '-i',
        outputPath,

        // Capture frame around 1 second.
        '-ss',
        '00:00:01',

        // Only one frame.
        '-frames:v',
        '1',

        // Width 640px, preserve aspect ratio.
        '-vf',
        'scale=640:-2',

        thumbnailPath,
      ]);

      console.log(`Thumbnail generated: ${videoId}`);

      // ----------------------------------------
      // 6. Read processed files
      // ----------------------------------------

      const processedVideo = await readFile(outputPath);

      const thumbnail = await readFile(thumbnailPath);

      // ----------------------------------------
      // 7. Generate Railway storage keys
      // ----------------------------------------

      const processedStorageKey = `videos/${userId}/${videoId}/processed.mp4`;

      const thumbnailStorageKey = `videos/${userId}/${videoId}/thumbnail.jpg`;

      // ----------------------------------------
      // 8. Upload processed MP4
      // ----------------------------------------

      await this.storageService.uploadObject(
        processedStorageKey,
        processedVideo,
        'video/mp4',
      );

      console.log(`Processed video uploaded: ${videoId}`);

      // ----------------------------------------
      // 9. Upload thumbnail
      // ----------------------------------------

      await this.storageService.uploadObject(
        thumbnailStorageKey,
        thumbnail,
        'image/jpeg',
      );

      console.log(`Thumbnail uploaded: ${videoId}`);

      // ----------------------------------------
      // 10. Mark video READY
      // ----------------------------------------

      await this.databaseService.db
        .update(videos)
        .set({
          processedStorageKey,
          thumbnailStorageKey,
          status: 'READY',
          updatedAt: new Date(),
        })
        .where(eq(videos.id, videoId));

      console.log(`Video READY: ${videoId}`);
    } finally {
      // ----------------------------------------
      // 11. Always clean temporary files
      // ----------------------------------------

      await rm(workDirectory, {
        recursive: true,
        force: true,
      });

      console.log(`Temporary files cleaned: ${videoId}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProcessVideoJob>) {
    console.log(`Video job completed: ${job.data.videoId}`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ProcessVideoJob> | undefined, error: Error) {
    if (!job) {
      return;
    }

    console.error(
      `Video processing attempt failed: ${job.data.videoId}`,
      error.message,
    );

    const maxAttempts = job.opts.attempts ?? 1;

    if (job.attemptsMade >= maxAttempts) {
      await this.databaseService.db
        .update(videos)
        .set({
          status: 'FAILED',
          updatedAt: new Date(),
        })
        .where(eq(videos.id, job.data.videoId));

      console.error(`Video permanently failed: ${job.data.videoId}`);
    }
  }
}
