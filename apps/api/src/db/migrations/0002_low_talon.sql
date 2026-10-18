ALTER TABLE "events" ADD COLUMN "roster_locked_at" timestamp with time zone;--> statement-breakpoint
-- Existing voting/ballot history also freezes the event roster.
UPDATE events e SET roster_locked_at = now()
WHERE EXISTS (SELECT 1 FROM votings v WHERE v.event_id = e.id AND v.status <> 'draft')
   OR EXISTS (SELECT 1 FROM ballots b WHERE b.event_id = e.id);
--> statement-breakpoint
-- Share the parent-event row lock with membership mutations. The marker is sticky;
-- reverting a voting to draft or removing a ballot cannot reopen the roster.
CREATE FUNCTION freeze_event_roster() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'ballots' OR NEW.status::text <> 'draft' THEN
    UPDATE events SET roster_locked_at = coalesce(roster_locked_at, now()) WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER votings_freeze_event_roster
BEFORE INSERT OR UPDATE OF event_id, status ON votings
FOR EACH ROW EXECUTE FUNCTION freeze_event_roster();
--> statement-breakpoint
CREATE TRIGGER ballots_freeze_event_roster
BEFORE INSERT OR UPDATE OF event_id ON ballots
FOR EACH ROW EXECUTE FUNCTION freeze_event_roster();
