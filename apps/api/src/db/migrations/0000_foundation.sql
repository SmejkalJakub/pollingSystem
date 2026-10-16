CREATE TYPE "public"."ballot_status" AS ENUM('draft', 'submitted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."jury_group_code" AS ENUM('T', 'V');--> statement-breakpoint
CREATE TYPE "public"."voting_kind" AS ENUM('selection', 'final');--> statement-breakpoint
CREATE TYPE "public"."voting_status" AS ENUM('draft', 'active', 'closed', 'archived');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_juror_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_one_actor" CHECK ("audit_logs"."actor_user_id" IS NULL OR "audit_logs"."actor_juror_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "ballot_entries" (
	"event_id" uuid NOT NULL,
	"voting_id" uuid NOT NULL,
	"ballot_id" uuid NOT NULL,
	"voting_item_id" uuid NOT NULL,
	"vote_value" smallint NOT NULL,
	CONSTRAINT "ballot_entries_ballot_id_voting_item_id_pk" PRIMARY KEY("ballot_id","voting_item_id"),
	CONSTRAINT "ballot_entries_vote_value" CHECK ("ballot_entries"."vote_value" IN (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "ballots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"voting_id" uuid NOT NULL,
	"juror_id" uuid NOT NULL,
	"status" "ballot_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ballots_voting_juror_unique" UNIQUE("voting_id","juror_id"),
	CONSTRAINT "ballots_scope_unique" UNIQUE("event_id","voting_id","id"),
	CONSTRAINT "ballots_revision_nonnegative" CHECK ("ballots"."revision" >= 0),
	CONSTRAINT "ballots_submission_timestamp" CHECK (("ballots"."status" != 'submitted' OR "ballots"."submitted_at" IS NOT NULL) AND ("ballots"."status" != 'draft' OR "ballots"."submitted_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "event_jurors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"jury_group_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_jurors_event_id_id_unique" UNIQUE("event_id","id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jury_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"code" "jury_group_code" NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "jury_groups_event_id_id_unique" UNIQUE("event_id","id"),
	CONSTRAINT "jury_groups_event_code_unique" UNIQUE("event_id","code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voting_allowed_groups" (
	"event_id" uuid NOT NULL,
	"voting_id" uuid NOT NULL,
	"jury_group_id" uuid NOT NULL,
	CONSTRAINT "voting_allowed_groups_voting_id_jury_group_id_pk" PRIMARY KEY("voting_id","jury_group_id")
);
--> statement-breakpoint
CREATE TABLE "voting_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"voting_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "voting_items_scope_unique" UNIQUE("event_id","voting_id","id")
);
--> statement-breakpoint
CREATE TABLE "votings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"kind" "voting_kind" NOT NULL,
	"status" "voting_status" DEFAULT 'draft' NOT NULL,
	"selected_places" integer,
	"max_plus_votes" integer,
	"max_minus_votes" integer,
	"allow_negative_votes" boolean,
	"display_order" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votings_event_id_id_unique" UNIQUE("event_id","id"),
	CONSTRAINT "votings_selected_places_positive" CHECK ("votings"."selected_places" > 0),
	CONSTRAINT "votings_plus_limit_nonnegative" CHECK ("votings"."max_plus_votes" >= 0),
	CONSTRAINT "votings_minus_limit_nonnegative" CHECK ("votings"."max_minus_votes" >= 0),
	CONSTRAINT "votings_disabled_minus_limit" CHECK ("votings"."allow_negative_votes" IS DISTINCT FROM false OR "votings"."max_minus_votes" IS NULL OR "votings"."max_minus_votes" = 0)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_same_event_juror_fk" FOREIGN KEY ("event_id","actor_juror_id") REFERENCES "public"."event_jurors"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_entries" ADD CONSTRAINT "ballot_entries_same_voting_ballot_fk" FOREIGN KEY ("event_id","voting_id","ballot_id") REFERENCES "public"."ballots"("event_id","voting_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_entries" ADD CONSTRAINT "ballot_entries_same_voting_item_fk" FOREIGN KEY ("event_id","voting_id","voting_item_id") REFERENCES "public"."voting_items"("event_id","voting_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_same_event_voting_fk" FOREIGN KEY ("event_id","voting_id") REFERENCES "public"."votings"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_same_event_juror_fk" FOREIGN KEY ("event_id","juror_id") REFERENCES "public"."event_jurors"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_jurors" ADD CONSTRAINT "event_jurors_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_jurors" ADD CONSTRAINT "event_jurors_same_event_group_fk" FOREIGN KEY ("event_id","jury_group_id") REFERENCES "public"."jury_groups"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jury_groups" ADD CONSTRAINT "jury_groups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_allowed_groups" ADD CONSTRAINT "voting_allowed_groups_same_event_voting_fk" FOREIGN KEY ("event_id","voting_id") REFERENCES "public"."votings"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_allowed_groups" ADD CONSTRAINT "voting_allowed_groups_same_event_group_fk" FOREIGN KEY ("event_id","jury_group_id") REFERENCES "public"."jury_groups"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_items" ADD CONSTRAINT "voting_items_same_event_voting_fk" FOREIGN KEY ("event_id","voting_id") REFERENCES "public"."votings"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votings" ADD CONSTRAINT "votings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_event_time_idx" ON "audit_logs" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "ballot_entries_item_idx" ON "ballot_entries" USING btree ("event_id","voting_id","voting_item_id");--> statement-breakpoint
CREATE INDEX "ballots_voting_status_idx" ON "ballots" USING btree ("voting_id","status");--> statement-breakpoint
CREATE INDEX "ballots_juror_idx" ON "ballots" USING btree ("event_id","juror_id");--> statement-breakpoint
CREATE INDEX "event_jurors_group_idx" ON "event_jurors" USING btree ("event_id","jury_group_id");--> statement-breakpoint
CREATE INDEX "voting_allowed_groups_group_idx" ON "voting_allowed_groups" USING btree ("event_id","jury_group_id");--> statement-breakpoint
CREATE INDEX "votings_event_status_idx" ON "votings" USING btree ("event_id","status");