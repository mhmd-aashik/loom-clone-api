import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { VideosModule } from './videos/videos.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { ShareController } from './share/share.controller';
import { ShareModule } from './share/share.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    AuthModule,
    VideosModule,
    StorageModule,
    QueueModule,
    ShareModule,
  ],
  controllers: [ShareController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
