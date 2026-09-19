import {
  bigint,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { users } from './user.schema';

// Current processing state of the video.
export const videoStatusEnum = pgEnum('video_status', [
  'UPLOADING',
  'PROCESSING',
  'READY',
  'FAILED',
]);

// Controls who can watch the video.
export const videoVisibilityEnum = pgEnum('video_visibility', [
  'PRIVATE',
  'PUBLIC',
]);

export const videos = pgTable('videos', {
  id: uuid('id').defaultRandom().primaryKey(),

  // The user who owns this video.
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
    }),

  title: varchar('title', {
    length: 255,
  }).notNull(),

  status: videoStatusEnum('status').default('UPLOADING').notNull(),

  visibility: videoVisibilityEnum('visibility').default('PRIVATE').notNull(),

  // Location of the original browser recording.
  // Example: videos/original/uuid.webm
  storageKey: varchar('storage_key', {
    length: 1000,
  }),

  // Location after FFmpeg processing.
  // Example: videos/processed/uuid.mp4
  processedStorageKey: varchar('processed_storage_key', {
    length: 1000,
  }),

  durationSeconds: integer('duration_seconds'),

  sizeBytes: bigint('size_bytes', {
    mode: 'number',
  }),

  mimeType: varchar('mime_type', {
    length: 100,
  }),

  createdAt: timestamp('created_at').defaultNow().notNull(),

  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
