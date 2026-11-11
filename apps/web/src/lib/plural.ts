const rules = new Intl.PluralRules('cs');

/** Czech count with the matching noun form: one (1), few (2–4), other (0, 5+). */
export function czechCount(
  count: number,
  forms: { one: string; few: string; other: string },
) {
  const category = rules.select(count);
  if (category === 'one') {
    return `${count} ${forms.one}`;
  }
  if (category === 'few') {
    return `${count} ${forms.few}`;
  }
  return `${count} ${forms.other}`;
}
