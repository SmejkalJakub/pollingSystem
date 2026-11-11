import { teamTableSnapshotSchema } from '@d21/contracts';
import { useResource } from './useResource';
import { ResourceState } from './ResourceState';
import { TeamTable } from './TeamTable';

export function TeamsManager({
  eventId,
  onExpired,
}: {
  eventId: string;
  onExpired: () => void;
}) {
  const resource = useResource(
    `/events/${eventId}/teams/table`,
    teamTableSnapshotSchema,
    onExpired,
  );
  return (
    <section className="mt-6" aria-labelledby="teams-heading">
      <h2 id="teams-heading" className="section-title">
        Soutěžní týmy
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Upravte týmy a uložte tabulku. Názvy a popisy se aktualizují ve všech
        jejich kategoriích.
      </p>
      <ResourceState
        resource={resource}
        errorTitle="Týmy se nepodařilo načíst"
      />
      {resource.data && (
        <TeamTable
          initial={resource.data}
          eventId={eventId}
          onExpired={onExpired}
        />
      )}
    </section>
  );
}
