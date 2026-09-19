import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { videos } from './video.schema';
import { users } from './user.schema';

export const videoShares = pgTable('video_shares', {
  id: uuid('id').defaultRandom().primaryKey(),

  videoId: uuid('video_id')
    .notNull()
    .references(() => videos.id, {
      onDelete: 'cascade',
    }),

  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, {
      onDelete: 'cascade',
    }),

  token: varchar('token', {
    length: 64,
  })
    .notNull()
    .unique(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
