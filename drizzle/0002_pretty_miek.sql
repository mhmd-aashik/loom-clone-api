CREATE TYPE "public"."video_status" AS ENUM('UPLOADING', 'PROCESSING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."video_visibility" AS ENUM('PRIVATE', 'PUBLIC');--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "video_status" DEFAULT 'UPLOADING' NOT NULL,
	"visibility" "video_visibility" DEFAULT 'PRIVATE' NOT NULL,
	"storage_key" varchar(1000),
	"processed_storage_key" varchar(1000),
	"duration_seconds" integer,
	"size_bytes" bigint,
	"mime_type" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;