import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateVideoDto } from './dto/create-video.dto';
import { VideosService } from './videos.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

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

  @Get(':videoId/playback-url')
  @UseGuards(JwtAuthGuard)
  getPlaybackUrl(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param('videoId')
    videoId: string,
  ) {
    return this.videosService.getPlaybackUrl(user.userId, videoId);
  }

  @Delete(':videoId')
  @UseGuards(JwtAuthGuard)
  deleteVideo(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param('videoId')
    videoId: string,
  ) {
    return this.videosService.deleteVideo(user.userId, videoId);
  }

  @Patch(':videoId')
  @UseGuards(JwtAuthGuard)
  updateVideo(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param('videoId')
    videoId: string,

    @Body()
    dto: UpdateVideoDto,
  ) {
    return this.videosService.updateVideo(user.userId, videoId, dto);
  }

  @Get('public/:videoId')
  getPublicVideo(
    @Param('videoId')
    videoId: string,
  ) {
    return this.videosService.getPublicVideo(videoId);
  }

  @Post(':videoId/share')
  @UseGuards(JwtAuthGuard)
  createShareLink(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param('videoId')
    videoId: string,
  ) {
    return this.videosService.createShareLink(user.userId, videoId);
  }
}
