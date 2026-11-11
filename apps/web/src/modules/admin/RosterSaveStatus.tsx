const plural = new Intl.PluralRules('cs');
const changeLabels = {
  one: 'neuložená změna',
  few: 'neuložené změny',
  other: 'neuložených změn',
} as const;
const errorLabels = {
  one: 'řádek potřebuje opravu',
  few: 'řádky potřebují opravu',
  other: 'řádků potřebuje opravu',
} as const;

function rosterPlural(count: number) {
  const category = plural.select(count);
  return category === 'one' || category === 'few' ? category : 'other';
}

export function RosterSaveStatus({
  changed,
  invalid,
}: {
  changed: number;
  invalid: number;
}) {
  const changes = `${changed} ${changeLabels[rosterPlural(changed)]}`;
  const errors = `${invalid} ${errorLabels[rosterPlural(invalid)]}`;
  if (changed > 0 && invalid > 0) {
    return (
      <p className="roster-save-status">
        <strong>{changes}</strong> · {errors}
      </p>
    );
  }
  if (changed > 0) {
    return (
      <p className="roster-save-status">
        <strong>{changes}</strong>
      </p>
    );
  }
  if (invalid > 0) {
    return (
      <p className="roster-save-status">
        <strong>{errors}</strong>
      </p>
    );
  }
  return <p className="roster-save-status">Žádné neuložené změny</p>;
}
