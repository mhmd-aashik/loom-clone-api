import { ConflictException, Injectable } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { users } from '../database/schemas';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const [existingUser] = await this.databaseService.db
      .select({
        id: users.id,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [user] = await this.databaseService.db
      .insert(users)
      .values({
        name: dto.name.trim(),
        email,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      });

    return user;
  }
}
 