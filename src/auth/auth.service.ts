import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { createHash, randomUUID } from 'crypto';

import * as bcrypt from 'bcrypt';
import { and, eq, gt } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { refreshTokens, users } from '../database/schemas';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

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

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id);

    const refreshTokenHash = await this.hashRefreshToken(refreshToken);

    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.databaseService.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async getProfile(userId: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async generateTokens(userId: string) {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    // Short-lived token used for normal API requests.
    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    // Long-lived token used only to obtain new access tokens.
    // `jti` makes two tokens issued in the same second unique.
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        jti: randomUUID(),
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(token: string) {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    let payload: { sub: string };

    // First verify that this is a valid refresh JWT.
    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
      }>(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload.sub;

    // Get this user's active refresh-token sessions.
    const sessions = await this.databaseService.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      );

    // Find which stored hash belongs to this token.
    let matchedSession: (typeof sessions)[number] | undefined;

    for (const session of sessions) {
      const matches = await this.compareRefreshToken(token, session.tokenHash);

      if (matches) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotation:
    // the old refresh token can no longer be used.
    await this.databaseService.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.id, matchedSession.id));

    // Generate a fresh access + refresh token.
    const { accessToken, refreshToken } = await this.generateTokens(userId);

    const refreshTokenHash = await this.hashRefreshToken(refreshToken);

    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store only the new refresh-token hash.
    await this.databaseService.db.insert(refreshTokens).values({
      userId,
      tokenHash: refreshTokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  // bcrypt only hashes the first 72 bytes, so digest the JWT first.
  private digestRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashRefreshToken(token: string) {
    return bcrypt.hash(this.digestRefreshToken(token), 12);
  }

  private compareRefreshToken(token: string, tokenHash: string) {
    return bcrypt.compare(this.digestRefreshToken(token), tokenHash);
  }

  async logout(token: string) {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    let payload: { sub: string };

    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
      }>(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload.sub;

    // Find all active sessions belonging to this user.
    const sessions = await this.databaseService.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, userId));

    let matchedSession: (typeof sessions)[number] | undefined;

    // Find the session belonging to this refresh token.
    for (const session of sessions) {
      const matches = await bcrypt.compare(token, session.tokenHash);

      if (matches) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke this session.
    await this.databaseService.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.id, matchedSession.id));

    return {
      message: 'Logged out successfully',
    };
  }
}
