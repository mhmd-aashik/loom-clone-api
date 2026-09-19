import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateVideoDto } from './dto/create-video.dto';
import { VideosService } from './videos.service';

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
}
