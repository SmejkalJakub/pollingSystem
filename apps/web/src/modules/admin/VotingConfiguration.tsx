import { useState } from 'react';
import { z } from 'zod';
import {
  votingConfigurationSchema,
  votingRecordSchema,
  type VotingRecord,
} from '@d21/contracts';
import { Button } from '@/components/ui/button';
import { MutationForm } from './MutationForm';
import { adminRequest } from './api';

const integerInput = z.string().regex(/^\d+$/).transform(Number);
const formSchema = z
  .strictObject({
    selectedPlaces: integerInput,
    maxPlusVotes: integerInput,
    maxMinusVotes: integerInput,
    allowNegativeVotes: z.enum(['yes', 'no']),
  })
  .transform((value) => ({
    ...value,
    allowNegativeVotes: value.allowNegativeVotes === 'yes',
  }))
  .pipe(votingConfigurationSchema);

export function VotingConfiguration({
  voting,
  onSaved,
  onExpired,
}: {
  voting: VotingRecord;
  onSaved: () => void;
  onExpired: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const placesLabel =
    voting.kind === 'selection'
      ? 'Počet postupujících týmů (slotů)'
      : 'Počet vítězů';
  return (
    <section
      className="mt-8 border-t border-border pt-6"
      aria-labelledby="configuration-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="configuration-heading" className="text-lg font-semibold">
          Pravidla hlasování
        </h2>
        {voting.status === 'draft' && (
          <Button
            className="min-h-11"
            variant="outline"
            disabled={editing}
            onClick={() => {
              setEditing(true);
              setNotice('');
            }}
          >
            Nastavit pravidla
          </Button>
        )}
      </div>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        {[
          [placesLabel, voting.selectedPlaces],
          ['Maximum kladných hlasů', voting.maxPlusVotes],
          ['Maximum záporných hlasů', voting.maxMinusVotes],
          [
            'Záporné hlasy',
            voting.allowNegativeVotes === null
              ? null
              : voting.allowNegativeVotes
                ? 'Povolené'
                : 'Zakázané',
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-medium">{value ?? 'Zatím neurčeno'}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Každý záporný hlas vyžaduje dva skutečně udělené kladné hlasy. Hlasy
        není nutné využít všechny. Limity zadává organizátor výslovně.
      </p>
      {voting.status !== 'draft' && (
        <p className="mt-3 text-sm text-muted-foreground">
          Pravidla, položky a oprávnění jsou po první aktivaci uzamčené.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
      {editing && voting.status === 'draft' && (
        <div className="mt-5">
          <MutationForm
            title="Nastavit pravidla"
            headingLevel={3}
            description="Kladných hlasů musí být více než vybíraných míst. Celkový limit kladných a záporných hlasů musí být před aktivací menší než počet týmů. Při zákazu záporných hlasů zadejte jejich maximum 0."
            initial={{
              selectedPlaces: String(voting.selectedPlaces ?? ''),
              maxPlusVotes: String(voting.maxPlusVotes ?? ''),
              maxMinusVotes: String(voting.maxMinusVotes ?? ''),
              allowNegativeVotes:
                voting.allowNegativeVotes === null
                  ? ''
                  : voting.allowNegativeVotes
                    ? 'yes'
                    : 'no',
            }}
            fields={[
              {
                key: 'selectedPlaces',
                label: placesLabel,
                inputType: 'number',
                invalidMessage: 'Zadejte kladný celý počet míst.',
              },
              {
                key: 'maxPlusVotes',
                label: 'Maximum kladných hlasů',
                inputType: 'number',
                invalidMessage:
                  'Zadejte celé číslo větší než počet vybíraných míst.',
              },
              {
                key: 'maxMinusVotes',
                label: 'Maximum záporných hlasů',
                inputType: 'number',
                invalidMessage:
                  'Zadejte celé nezáporné číslo, nejvýše polovinu kladného limitu. Při zákazu zadejte 0.',
              },
              {
                key: 'allowNegativeVotes',
                label: 'Záporné hlasy',
                placeholder: 'Vyberte možnost',
                options: [
                  { value: 'yes', label: 'Povolit' },
                  { value: 'no', label: 'Zakázat' },
                ],
              },
            ]}
            schema={formSchema}
            onExpired={onExpired}
            cancel={() => setEditing(false)}
            save={async (input) => {
              await adminRequest(
                `/votings/${voting.id}/configuration`,
                votingRecordSchema,
                { method: 'PUT', body: input },
              );
              setEditing(false);
              setNotice('Pravidla byla uložena.');
              onSaved();
            }}
          />
        </div>
      )}
    </section>
  );
}
