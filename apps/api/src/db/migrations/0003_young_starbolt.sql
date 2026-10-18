CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_event_id_id_unique" UNIQUE("event_id","id")
);
--> statement-breakpoint
ALTER TABLE "voting_items" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_items" ADD CONSTRAINT "voting_items_same_event_team_fk" FOREIGN KEY ("event_id","team_id") REFERENCES "public"."teams"("event_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_items" ADD CONSTRAINT "voting_items_voting_team_unique" UNIQUE("voting_id","team_id");
--> statement-breakpoint
-- Preserve legacy identity: one distinct team per existing item. Never merge by name.
-- Item IDs, original display snapshots and all ballot references remain unchanged.
INSERT INTO teams (id,event_id,name,description)
SELECT id,event_id,name,description FROM voting_items;
--> statement-breakpoint
UPDATE voting_items SET team_id=id WHERE team_id IS NULL;
