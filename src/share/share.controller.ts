import { Controller, Get, Param } from '@nestjs/common';

import { VideosService } from '../videos/videos.service';

@Controller('share')
export class ShareController {
  constructor(private readonly videosService: VideosService) {}

  @Get(':token')
  getSharedVideo(
    @Param('token')
    token: string,
  ) {
    return this.videosService.getSharedVideo(token);
  }
}
