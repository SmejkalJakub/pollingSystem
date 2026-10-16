CREATE TABLE "admin_access" (
	"key" text PRIMARY KEY DEFAULT 'administration' NOT NULL,
	"user_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_access_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "admin_access_singleton" CHECK ("admin_access"."key" = 'administration')
);
--> statement-breakpoint
CREATE TABLE "juror_access" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"juror_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "juror_access_hash_format" CHECK ("juror_access"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"admin_user_id" uuid,
	"event_id" uuid,
	"juror_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_one_actor" CHECK (("sessions"."admin_user_id" IS NOT NULL AND "sessions"."event_id" IS NULL AND "sessions"."juror_id" IS NULL) OR ("sessions"."admin_user_id" IS NULL AND "sessions"."event_id" IS NOT NULL AND "sessions"."juror_id" IS NOT NULL)),
	CONSTRAINT "sessions_expiry" CHECK ("sessions"."expires_at" > "sessions"."created_at"),
	CONSTRAINT "sessions_hash_format" CHECK ("sessions"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "admin_access" ADD CONSTRAINT "admin_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "juror_access" ADD CONSTRAINT "juror_access_same_event_fk" FOREIGN KEY ("event_id","juror_id") REFERENCES "public"."event_jurors"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_user_id_admin_access_user_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_access"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_same_event_juror_fk" FOREIGN KEY ("event_id","juror_id") REFERENCES "public"."event_jurors"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "juror_access_juror_idx" ON "juror_access" USING btree ("event_id","juror_id");--> statement-breakpoint
CREATE INDEX "sessions_admin_idx" ON "sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "sessions_juror_idx" ON "sessions" USING btree ("event_id","juror_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");