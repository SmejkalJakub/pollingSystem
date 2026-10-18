import ExcelJS from 'exceljs';
import type {
  DashboardOverview,
  ResultsOverview,
  ResultsCategory,
  JurorProgress,
  DashboardProblem,
  ResultsReason,
} from '@d21/contracts';

const lifecycle = {
  draft: 'Koncept',
  active: 'Otevřeno',
  closed: 'Uzavřeno',
  archived: 'Archivováno',
};
const progress: Record<JurorProgress, string> = {
  not_started: 'Nezahájeno',
  in_progress: 'Uložený návrh',
  submitted: 'Odevzdáno',
  invalid_draft: 'Neplatný návrh',
  locked: 'Uzamčený lístek',
};
const problems: Record<DashboardProblem, string> = {
  CONFIGURATION_NOT_READY: 'Pravidla nebo počet položek nejsou připravené',
  UNLINKED_ITEMS: 'Položky bez propojení s týmem',
  NO_ELIGIBLE_JURORS: 'Bez oprávněných porotců',
  INVALID_DRAFT: 'Neplatné uložené návrhy',
  LOCKED_BALLOT: 'Zrušené lístky zůstávají uzamčené',
  UNAVAILABLE_PENDING: 'Uzavřená kategorie s neodevzdanými lístky',
  INELIGIBLE_BALLOTS: 'Neoprávněné lístky jsou vyloučené',
  INVALID_SUBMISSION:
    'Součty zahrnují neplatné uložené odevzdání; nutná kontrola',
};
const reasons: Record<ResultsReason, string> = {
  NOT_CLOSED: 'Hlasování ještě není uzavřené',
  PENDING_BALLOTS: 'Chybějící odevzdání',
  DATA_PROBLEMS: 'Uložená data vyžadují kontrolu',
  CUTOFF_TIE: 'Nerozhodnutá shoda přes hranici výběru',
};
const stage = (c: ResultsCategory) =>
  c.stage === 'final' ? 'Finální výsledek' : 'Průběžný výsledek';

// This is a dated server snapshot, not an editable model or certification.
// Strings are literal XLSX string cells, including labels starting with =/+/-/@.
export async function createResultsWorkbook(
  results: ResultsOverview,
  participation: DashboardOverview,
) {
  const book = new ExcelJS.Workbook();
  book.creator = 'D21';
  book.created = new Date(results.asOf);
  book.modified = new Date(results.asOf);
  function sheet(
    name: string,
    title: string,
    headers: string[],
    widths: number[],
    note: string,
  ) {
    const ws = book.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 5 }],
    });
    ws.columns = widths.map((width) => ({ width }));
    ws.addRow([title]);
    ws.addRow([results.event.name, results.event.id]);
    ws.addRow(['Data a export k (UTC)', results.asOf]);
    ws.addRow([note]);
    ws.mergeCells(1, 1, 1, headers.length);
    ws.mergeCells(4, 1, 4, headers.length);
    ws.getRow(1).font = {
      name: 'Calibri',
      size: 18,
      bold: true,
      color: { argb: 'FF242824' },
    };
    ws.getRow(1).height = 32;
    ws.getRow(2).alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(2).height = Math.max(
      32,
      16 * Math.ceil(results.event.name.length / 25),
    );
    ws.getRow(4).height = 36;
    ws.getRow(4).alignment = { wrapText: true, vertical: 'middle' };
    ws.addRow(headers);
    ws.getRow(5).height = 32;
    ws.getRow(5).alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(5).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    ws.getRow(5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF242824' },
    };
    return ws;
  }
  const categories = sheet(
    'Kategorie',
    'Přehled kategorií',
    [
      'Kategorie',
      'ID kategorie',
      'Kolo',
      'Stav hlasování',
      'Výsledek',
      'Poroty',
      'Míst',
      'Oprávněných',
      'Odevzdáno',
      'Chybí',
      'Neplatných návrhů',
      'Uzamčených',
      'Shoda na hranici',
      'Důvody průběžnosti',
      'Ke kontrole',
    ],
    [30, 39, 18, 20, 24, 15, 10, 14, 14, 12, 20, 16, 20, 55, 60],
    'Aktuální odevzdané lístky oprávněných porotců; návrhy a historie se nezapočítávají. Koncepty jsou pouze příprava.',
  );
  const rows = sheet(
    'Výsledky',
    'Výsledky týmů',
    [
      'Kategorie',
      'ID kategorie',
      'Tým',
      'ID týmu',
      'ID položky',
      'Popis',
      'Pozitivní',
      'Negativní',
      'Skóre',
      'Pořadí',
      'Sdílené pořadí',
      'Výběr',
      'Výsledek',
    ],
    [30, 39, 30, 39, 39, 55, 14, 14, 12, 12, 20, 30, 24],
    'Skóre = pozitivní − negativní. Shodné skóre sdílí pořadí (1, 2, 2, 4); celá shoda přes hranici zůstává nerozhodnutá. Důvody a problémy jsou na listu Kategorie.',
  );
  const jurors = sheet(
    'Účast',
    'Účast porotců',
    [
      'Kategorie',
      'ID kategorie',
      'Stav hlasování',
      'Porotce',
      'ID porotce',
      'Porota',
      'ID poroty',
      'Stav lístku',
      'Uloženo (UTC)',
      'Odevzdáno (UTC)',
    ],
    [30, 39, 20, 30, 39, 15, 39, 24, 30, 30],
    'Pouze aktuálně oprávnění porotci v každé kategorii, včetně plánovaných přiřazení konceptů. Stav a dostupnost jsou oddělené; jednotlivé volby ani historie se neexportují.',
  );
  for (const c of results.categories) {
    categories.addRow([
      c.name,
      c.id,
      c.kind === 'selection' ? 'Výběrové' : 'Finálové',
      lifecycle[c.status],
      stage(c),
      c.groups.map((g) => g.code).join(' + '),
      c.selectedPlaces,
      c.counts.expected,
      c.counts.submitted,
      c.counts.pending,
      c.counts.invalid,
      c.counts.locked,
      c.boundaryTie ? 'Ano' : 'Ne',
      c.reasons.map((r) => reasons[r]).join('; '),
      c.problems.map((p) => problems[p]).join('; '),
    ]);
    for (const r of c.rows) {
      const selection = c.problems.includes('CONFIGURATION_NOT_READY')
        ? 'Výběr není vyhodnocen'
        : r.selection === 'unresolved'
          ? 'Nerozhodnutá shoda'
          : r.selection === 'outside'
            ? 'Mimo výběr'
            : c.stage === 'provisional'
              ? c.kind === 'selection'
                ? 'Průběžně postupuje'
                : 'Průběžně ve výběru'
              : c.kind === 'selection'
                ? 'Postupuje'
                : 'Vítěz';
      rows.addRow([
        c.name,
        c.id,
        r.name,
        r.teamId,
        r.id,
        r.description,
        r.plus,
        r.minus,
        r.score,
        r.rank,
        r.tied ? 'Ano' : 'Ne',
        selection,
        stage(c),
      ]);
    }
  }
  for (const c of participation.categories)
    for (const j of c.jurors)
      jurors.addRow([
        c.name,
        c.id,
        lifecycle[c.status],
        j.displayName,
        j.id,
        c.groups.find((g) => g.id === j.groupId)!.code,
        j.groupId,
        progress[j.progress],
        j.savedAt,
        j.submittedAt,
      ]);
  for (const ws of book.worksheets) {
    ws.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: Math.max(5, ws.rowCount), column: ws.columnCount },
    };
    ws.eachRow((row, index) => {
      if (index <= 5) return;
      let lines = 1;
      row.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11 };
        cell.alignment = { vertical: 'top', wrapText: true };
        if (index % 2 === 0)
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4EF' },
          };
        if (typeof cell.value === 'number') cell.numFmt = '0';
        else if (typeof cell.value === 'string') {
          const width = ws.getColumn(cell.col).width ?? 20;
          lines = Math.max(
            lines,
            cell.value
              .split('\n')
              .reduce(
                (total, line) =>
                  total +
                  Math.max(1, Math.ceil(line.length / Math.max(1, width - 2))),
                0,
              ),
          );
        }
      });
      row.height = Math.min(409, Math.max(32, lines * 15 + 10));
    });
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
