import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { VideosModule } from './videos/videos.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [DatabaseModule, AuthModule, VideosModule, StorageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
