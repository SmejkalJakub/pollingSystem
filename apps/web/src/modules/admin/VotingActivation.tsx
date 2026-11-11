import { votingActionSchema, votingRecordSchema } from '@d21/contracts';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';

export function VotingActivation({
  votingId,
  onExpired,
  onCancel,
  onActivated,
}: {
  votingId: string;
  onExpired: () => void;
  onCancel: () => void;
  onActivated: () => void;
}) {
  return (
    <MutationForm
      title="Aktivovat hlasování"
      description="Server ověří pravidla, týmy a oprávnění. Počty členů Technické a Veřejné poroty mohou být libovolné a rozdílné. Aktivace uzamkne pravidla kategorie a přiřazení stávajících porotců. Nové porotce můžete přidat i později."
      initial={{}}
      fields={[]}
      schema={votingActionSchema}
      submitLabel="Aktivovat"
      onExpired={onExpired}
      cancel={onCancel}
      save={async () => {
        await adminRequest(
          `/votings/${votingId}/activate`,
          votingRecordSchema,
          {
            method: 'POST',
            body: {},
          },
        );
        onActivated();
      }}
    />
  );
}
