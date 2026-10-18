import type { FormField } from './MutationForm';

export const votingFields: FormField[] = [
  { key: 'name', label: 'Název hlasování', maxLength: 200 },
  {
    key: 'instructions',
    label: 'Instrukce (nepovinné)',
    multiline: true,
    maxLength: 5000,
  },
  {
    key: 'kind',
    label: 'Kolo',
    placeholder: 'Vyberte kolo',
    options: [
      { value: 'selection', label: 'Výběrové' },
      { value: 'final', label: 'Finálové' },
    ],
  },
];
export const votingStatusLabels = {
  draft: 'Koncept',
  active: 'Probíhá',
  closed: 'Uzavřeno',
  archived: 'Archivováno',
};
