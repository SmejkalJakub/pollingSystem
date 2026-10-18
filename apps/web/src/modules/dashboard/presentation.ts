import type {
  DashboardCategory,
  DashboardProblem,
  JurorProgress,
} from '@d21/contracts';
export const stateLabels: Record<DashboardCategory['state'], string> = {
  ready: 'Připraveno',
  in_progress: 'Probíhá',
  done: 'Hotovo',
  problem: 'Problém',
};
export const lifecycleLabels = {
  draft: 'Koncept',
  active: 'Otevřeno',
  closed: 'Uzavřeno',
  archived: 'Archivováno',
};
export const progressLabels: Record<JurorProgress, string> = {
  not_started: 'Nezahájeno',
  in_progress: 'Uložený návrh',
  submitted: 'Odevzdáno',
  invalid_draft: 'Neplatný návrh',
  locked: 'Uzamčený lístek',
};
export const problemLabels: Record<DashboardProblem, string> = {
  CONFIGURATION_NOT_READY: 'Pravidla nebo počet položek nejsou připravené.',
  UNLINKED_ITEMS: 'Některé položky nejsou propojené s týmy.',
  NO_ELIGIBLE_JURORS: 'Kategorie nemá oprávněné porotce.',
  INVALID_DRAFT: 'Neplatné uložené návrhy vyžadují opravu porotcem.',
  LOCKED_BALLOT: 'Zrušený lístek zůstává uzamčený.',
  UNAVAILABLE_PENDING: 'Kategorie je uzavřená a část lístků není odevzdaná.',
  INELIGIBLE_BALLOTS:
    'Existují lístky mimo aktuální oprávnění; nejsou započtené.',
  INVALID_SUBMISSION:
    'Odevzdaný lístek neodpovídá současným pravidlům. Zkontrolujte uložená data.',
};
export function timestamp(value: string) {
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
