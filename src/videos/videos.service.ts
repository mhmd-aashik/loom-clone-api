import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { videos } from '../database/schemas';
import { CreateVideoDto } from './dto/create-video.dto';

@Injectable()
export class VideosService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(userId: string, dto: CreateVideoDto) {
    const [video] = await this.databaseService.db
      .insert(videos)
      .values({
        ownerId: userId,
        title: dto.title.trim(),
        visibility: dto.visibility ?? 'PRIVATE',
        status: 'UPLOADING',
      })
      .returning();

    return video;
  }
}
