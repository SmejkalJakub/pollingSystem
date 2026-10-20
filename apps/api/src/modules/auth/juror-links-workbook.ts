import ExcelJS from 'exceljs';
import { juryGroupLabel } from '@d21/contracts';

export type JurorLinkExportRow = {
  id: string;
  displayName: string;
  groupCode: 'T' | 'V';
  groupName: string;
  url: string | null;
  status: 'stored' | 'legacy' | 'revoked' | 'none';
};
const statuses = {
  stored: 'Aktivní odkaz',
  legacy: 'Starší odkaz nelze obnovit; pro export jej výslovně nahraďte',
  revoked: 'Přístup byl zrušen',
  none: 'Odkaz dosud nebyl vytvořen; uložte tabulku porotců',
};

// Dedicated credential export. Never include this sheet in results exports.
export async function createJurorLinksWorkbook(
  event: { id: string; name: string },
  rows: JurorLinkExportRow[],
  asOf: string,
) {
  const book = new ExcelJS.Workbook();
  book.creator = 'D21';
  book.created = new Date(asOf);
  book.modified = new Date(asOf);
  const sheet = book.addWorksheet('Odkazy porotců', {
    views: [{ state: 'frozen', ySplit: 5 }],
  });
  sheet.columns = [32, 20, 30, 90, 65, 39].map((width) => ({ width }));
  sheet.addRow(['Osobní odkazy porotců']);
  sheet.addRow([event.name, event.id]);
  sheet.addRow(['Export (UTC)', asOf]);
  sheet.addRow([
    'Soukromé přístupové odkazy. Každému porotci předejte pouze jeho vlastní odkaz. Export odkazy nemění.',
  ]);
  sheet.mergeCells('A1:F1');
  sheet.mergeCells('A4:F4');
  sheet.addRow([
    'Porotce',
    'Porota',
    'Název poroty',
    'Osobní odkaz',
    'Stav přístupu',
    'ID porotce',
  ]);
  for (const juror of rows) {
    const row = sheet.addRow([
      juror.displayName,
      juryGroupLabel(juror.groupCode),
      juror.groupName,
      juror.url ? { text: juror.url, hyperlink: juror.url } : '',
      statuses[juror.status],
      juror.id,
    ]);
    if (juror.url)
      row.getCell(4).font = { color: { argb: 'FF0563C1' }, underline: true };
  }
  sheet.autoFilter = { from: 'A5', to: `F${Math.max(5, sheet.rowCount)}` };
  sheet.eachRow((row, index) => {
    row.alignment = { vertical: 'top', wrapText: true };
    let lines = 1;
    row.eachCell((cell) => {
      const width = sheet.getColumn(cell.col).width ?? 20;
      lines = Math.max(
        lines,
        cell.text
          .split('\n')
          .reduce(
            (sum, line) =>
              sum +
              Math.max(1, Math.ceil(line.length / Math.max(1, width - 2))),
            0,
          ),
      );
    });
    row.height =
      index === 1 ? 32 : Math.min(409, Math.max(48, lines * 15 + 10));
    if (index === 1 || index === 5)
      row.font = { name: 'Calibri', size: index === 1 ? 18 : 11, bold: true };
  });
  return Buffer.from(await book.xlsx.writeBuffer());
}
