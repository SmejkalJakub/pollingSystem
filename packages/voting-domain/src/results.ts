export type ResultTotal = {
  id: string;
  plus: number;
  minus: number;
  displayOrder: number;
};

// Competition ranks count teams above, not distinct scores: 1, 2, 2, 4.
// Stable row order within a score group is presentation only, never a tie-break.
export function rankResults<T extends ResultTotal>(
  totals: readonly T[],
  places: number | null,
) {
  const sorted = totals
    .map((item) => ({ ...item, score: item.plus - item.minus }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.displayOrder - b.displayOrder ||
        a.id.localeCompare(b.id),
    );
  const cutoff =
    places !== null && places > 0 && places < sorted.length
      ? sorted[places - 1]!.score
      : undefined;
  const boundaryTie = cutoff !== undefined && sorted[places!]!.score === cutoff;
  let rank = 0;
  const rows = sorted.map((item, index) => {
    if (index === 0 || sorted[index - 1]!.score !== item.score)
      rank = index + 1;
    const tied =
      sorted[index - 1]?.score === item.score ||
      sorted[index + 1]?.score === item.score;
    const selection: 'selected' | 'unresolved' | 'outside' =
      places === null || places <= 0
        ? 'outside'
        : boundaryTie && item.score === cutoff
          ? 'unresolved'
          : rank <= places
            ? 'selected'
            : 'outside';
    return { ...item, rank, tied, selection };
  });
  return { rows, boundaryTie };
}
