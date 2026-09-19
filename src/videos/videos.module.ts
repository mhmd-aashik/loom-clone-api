import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { VideoProcessor } from './processors/video.processor';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuthModule, StorageModule, QueueModule, RealtimeModule],
  controllers: [VideosController],
  providers: [VideosService, VideoProcessor],
  exports: [VideosService],
})
export class VideosModule {}
