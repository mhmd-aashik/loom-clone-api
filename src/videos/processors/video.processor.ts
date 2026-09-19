import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { mkdir, writeFile } from 'node:fs/promises';

import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import { StorageService } from '../../storage/storage.service';

const execFileAsync = promisify(execFile);

interface ProcessVideoJob {
  videoId: string;
  userId: string;
  storageKey: string;
}

@Processor('video-processing')
export class VideoProcessor extends WorkerHost {
  constructor(private readonly storageService: StorageService) {
    super();
  }

  async process(job: Job<ProcessVideoJob>): Promise<void> {
    const { videoId, storageKey } = job.data;

    console.log(`Starting video processing: ${videoId}`);

    // Create a temporary directory specifically
    // for this video-processing job.
    const workDirectory = join(tmpdir(), 'loom-video-processing', videoId);

    await mkdir(workDirectory, {
      recursive: true,
    });

    // Keep the same extension as the object
    // stored in Railway.
    const extension = storageKey.endsWith('.mp4') ? 'mp4' : 'webm';

    const inputPath = join(workDirectory, `original.${extension}`);

    // Download the original video from
    // Railway Storage.
    const videoBytes = await this.storageService.downloadObject(storageKey);

    // Write it temporarily to disk so FFmpeg
    // can work with a normal file.
    await writeFile(inputPath, videoBytes);

    const outputPath = join(workDirectory, 'processed.mp4');

    console.log(`FFmpeg processing started: ${videoId}`);

    await execFileAsync('ffmpeg', [
      '-y',

      // Input video
      '-i',
      inputPath,

      // H.264 video
      '-c:v',
      'libx264',

      // Good web compatibility
      '-preset',
      'fast',

      // Balance between quality and file size
      '-crf',
      '23',

      // AAC audio
      '-c:a',
      'aac',

      // Better browser streaming behavior
      '-movflags',
      '+faststart',

      outputPath,
    ]);

    console.log(`FFmpeg processing completed: ${outputPath}`);

    console.log(`Video downloaded to: ${inputPath}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ProcessVideoJob>) {
    console.log(`Video job completed: ${job.data.videoId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProcessVideoJob> | undefined, error: Error) {
    console.error(`Video job failed: ${job?.data.videoId}`, error.message);
  }
}
