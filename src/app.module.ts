import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { VideosModule } from './videos/videos.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { ShareController } from './share/share.controller';
import { ShareModule } from './share/share.module';

@Module({
  imports: [DatabaseModule, AuthModule, VideosModule, StorageModule, QueueModule, ShareModule],
  controllers: [AppController, ShareController],
  providers: [AppService],
})
export class AppModule {}
