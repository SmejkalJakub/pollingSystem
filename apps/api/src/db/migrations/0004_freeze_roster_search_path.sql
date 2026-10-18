-- Pin lookup order in the invoker trigger without changing applied migrations.
ALTER FUNCTION public.freeze_event_roster() SET search_path = public, pg_temp;
