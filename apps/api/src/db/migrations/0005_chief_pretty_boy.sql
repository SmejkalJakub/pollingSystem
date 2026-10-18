ALTER TABLE "sessions" DROP CONSTRAINT "sessions_expiry";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "juror_access" ADD COLUMN "encrypted_token" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_expiry" CHECK ("sessions"."admin_user_id" IS NULL OR "sessions"."expires_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiry" CHECK (("sessions"."expires_at" IS NULL AND "sessions"."admin_user_id" IS NULL) OR "sessions"."expires_at" > "sessions"."created_at");
--> statement-breakpoint
-- Convert only sessions still valid at the transition. Never revive expired/revoked access.
UPDATE "sessions" SET "expires_at" = NULL
WHERE "juror_id" IS NOT NULL AND "revoked_at" IS NULL
  AND "expires_at" > statement_timestamp();
