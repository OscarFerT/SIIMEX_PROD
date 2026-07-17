import ExcelJS from 'exceljs';

export type XlsxCellValue = string | number | boolean | Date | null | undefined;

function sanitizeSheetName(name: string): string {
  const base = (name || 'Hoja1').trim() || 'Hoja1';
  return base.replace(/[\\/*?:[\]]/g, '_').slice(0, 31);
}

function ensureXlsxName(fileName: string): string {
  const base = (fileName || 'reporte').trim() || 'reporte';
  return base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`;
}

function computeColumnWidths(headers: string[], rows: XlsxCellValue[][]): number[] {
  return headers.map((header, colIdx) => {
    const maxRowLen = rows.reduce((acc, row) => {
      const value = row[colIdx];
      const len = value == null ? 0 : String(value).length;
      return Math.max(acc, len);
    }, 0);
    return Math.min(60, Math.max(header.length + 2, maxRowLen + 2, 12));
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = ensureXlsxName(fileName);
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function normalizeCellValue(value: ExcelJS.CellValue): string {
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? '').join('').trim();
    }
    if ('result' in value) {
      return String(value.result ?? '').trim();
    }
    if ('hyperlink' in value && 'text' in value) {
      return String(value.text ?? value.hyperlink ?? '').trim();
    }
  }
  return String(value).trim();
}

export function exportRowsAsXlsx(
  headers: string[],
  rows: XlsxCellValue[][],
  fileName: string,
  sheetName = 'Datos'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sanitizeSheetName(sheetName));
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.columns = computeColumnWidths(headers, rows).map((width) => ({ width }));

  return workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    downloadBlob(blob, fileName);
  });
}

export async function readFirstSheetAsRows(file: File): Promise<string[][]> {
  try {
    const data = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return [];
    }

    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = [];
      for (let col = 1; col <= row.cellCount; col += 1) {
        cells.push(normalizeCellValue(row.getCell(col).value));
      }
      rows.push(cells);
    });
    return rows;
  } catch (err) {
    throw err instanceof Error ? err : new Error('No se pudo leer el archivo XLSX');
  }
}
