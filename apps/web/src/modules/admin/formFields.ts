export const eventFields = [
  {
    key: 'name',
    label: 'Název eventu',
    maxLength: 200,
    invalidMessage: 'Zadejte název o délce 1 až 200 znaků.',
  },
  {
    key: 'description',
    label: 'Popis (nepovinný)',
    multiline: true,
    maxLength: 5000,
    invalidMessage: 'Zkraťte popis na nejvýše 5 000 znaků.',
  },
];
