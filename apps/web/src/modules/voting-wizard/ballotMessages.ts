import type { BallotIssue } from '@d21/contracts';

export const messages: Record<BallotIssue, string> = {
  CONFIGURATION_NOT_READY:
    'Pravidla nebo týmy nejsou připravené. Obraťte se na organizátora.',
  VOTING_UNAVAILABLE:
    'Hlasování již není otevřené. V této kategorii nelze zadávat hlasy.',
  UNKNOWN_ITEM: 'Výběr obsahuje tým, který do této kategorie nepatří.',
  DUPLICATE_ITEM: 'Jeden tým může mít pouze jeden hlas.',
  PLUS_LIMIT: 'Bylo dosaženo maxima kladných hlasů. Nejprve některý odeberte.',
  MINUS_LIMIT:
    'Bylo dosaženo maxima záporných hlasů. Nejprve některý odeberte.',
  NEGATIVES_DISABLED: 'Záporné hlasy nejsou v této kategorii povoleny.',
  NEGATIVE_ELIGIBILITY:
    'Každý záporný hlas potřebuje dva skutečně rozdané kladné hlasy. Přidejte kladné hlasy nebo odeberte záporné.',
};
