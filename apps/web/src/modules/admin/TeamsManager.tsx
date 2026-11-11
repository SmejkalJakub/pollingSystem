import { teamTableReadSchema } from '@d21/contracts';
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
    teamTableReadSchema,
    onExpired,
  );
  const heading = (
    <div className="roster-page-head">
      <h1 id="teams-heading">Týmy</h1>
      <p>Sdílené pro všechny kategorie eventu.</p>
    </div>
  );
  return (
    <section aria-labelledby="teams-heading">
      {!resource.data && heading}
      <ResourceState
        resource={resource}
        errorTitle="Týmy se nepodařilo načíst"
      />
      {resource.data && (
        <TeamTable
          initial={resource.data}
          eventId={eventId}
          heading={heading}
          onExpired={onExpired}
        />
      )}
    </section>
  );
}
