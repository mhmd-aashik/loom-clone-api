import { Module } from '@nestjs/common';

import { ShareController } from './share.controller';
import { VideosModule } from '../videos/videos.module';

@Module({
  imports: [VideosModule],
  controllers: [ShareController],
})
export class ShareModule {}
