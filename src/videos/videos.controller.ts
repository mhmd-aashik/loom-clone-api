import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateVideoDto } from './dto/create-video.dto';
import { VideosService } from './videos.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: CreateVideoDto,
  ) {
    return this.videosService.create(user.userId, dto);
  }

  @Post(':videoId/upload-url')
  @UseGuards(JwtAuthGuard)
  createUploadUrl(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param('videoId')
    videoId: string,

    @Body()
    dto: CreateUploadUrlDto,
  ) {
    return this.videosService.createUploadUrl(
      user.userId,
      videoId,
      dto.contentType,
    );
  }

  @Post(':videoId/upload-complete')
  @UseGuards(JwtAuthGuard)
  completeUpload(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param('videoId')
    videoId: string,
  ) {
    return this.videosService.completeUpload(user.userId, videoId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getMyVideos(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.videosService.getMyVideos(user.userId);
  }

  @Get(':videoId')
  @UseGuards(JwtAuthGuard)
  getVideo(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param('videoId')
    videoId: string,
  ) {
    return this.videosService.getVideo(user.userId, videoId);
  }
}
