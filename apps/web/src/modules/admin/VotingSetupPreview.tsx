import type { VotingSetupValues } from '@d21/contracts';
import { categoryPlaces } from './category-readiness';

export function VotingSetupPreview({
  values,
  teamCount,
}: {
  values: VotingSetupValues;
  teamCount: number;
}) {
  const { maxPlusVotes, maxMinusVotes, selectedPlaces, allowNegativeVotes } =
    values.configuration;
  const kind = values.kind === 'selection' ? 'Výběrové kolo' : 'Finále';

  function budget(label: string, limit: number | null) {
    // The numeric limit remains visible even if the decorative pips are capped.
    const pips =
      limit === null ? 2 : Math.max(0, Math.min(Math.floor(limit), 16));
    return (
      <div>
        <p>
          {label} <strong>0/{limit ?? '?'}</strong>
        </p>
        <div className="category-pips" aria-hidden="true">
          {Array.from({ length: pips }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      className="category-panel category-preview text-sm"
      aria-label="Co uvidí porotce"
    >
      <h2 className="font-semibold">Co uvidí porotce</h2>
      <p className="my-2 text-header-muted">
        {values.kind && `${kind} · `}
        {selectedPlaces !== null &&
          `${categoryPlaces(values.kind, selectedPlaces)} · `}
        {teamCount} týmů
      </p>
      {budget('Kladné', maxPlusVotes)}
      {allowNegativeVotes !== false && budget('Záporné', maxMinusVotes)}
      {allowNegativeVotes === false && (
        <p className="text-header-muted">Záporné hlasy nejsou povoleny.</p>
      )}
      {allowNegativeVotes === true && (
        <p className="text-header-muted">
          Každý záporný hlas vyžaduje dva rozdané kladné.
        </p>
      )}
    </section>
  );
}
