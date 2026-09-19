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
    const { videoId, storageKey } = job.data;

    const workDirectory = join(tmpdir(), 'loom-video-processing', videoId);

    try {
      await mkdir(workDirectory, {
        recursive: true,
      });

      // Everything we already wrote:
      // download
      // write original
      // FFmpeg
      // upload processed.mp4
      // update DB → READY
    } finally {
      // Always clean temporary files.
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
