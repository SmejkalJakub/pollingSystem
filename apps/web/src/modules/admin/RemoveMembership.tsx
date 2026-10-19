import { z } from 'zod';
import type { JurorRecord } from '@d21/contracts';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';

export function RemoveMembership({
  juror,
  base,
  cancel,
  done,
  onExpired,
}: {
  juror: JurorRecord;
  base: string;
  cancel: () => void;
  done: () => void;
  onExpired: () => void;
}) {
  return (
    <div className="mt-6">
      <MutationForm
        headingLevel={3}
        title={`Odebrat členství: ${juror.displayName}?`}
        initial={{}}
        fields={[]}
        schema={z.strictObject({})}
        cancel={cancel}
        onExpired={onExpired}
        description="Porotce bude trvale odebrán z tohoto eventu. Tuto akci nelze vrátit zpět. Pokud má členství navázané záznamy, server odebrání odmítne."
        submitLabel="Odebrat členství"
        destructive
        save={async () => {
          await adminRequest(`${base}/jurors/${juror.id}`, z.undefined(), {
            method: 'DELETE',
          });
          done();
        }}
      />
    </div>
  );
}
