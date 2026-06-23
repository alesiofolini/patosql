import * as XLSX from 'xlsx';
import type { QueryResult } from '../ui/results';

function exportValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return value as string | number | boolean;
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function defaultBaseName(baseName?: string): string {
  const safe = (baseName ?? 'resultados')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'resultados';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${safe}_${stamp}`;
}

export function exportResultToCsv(result: QueryResult, baseName?: string): void {
  const header = result.columns.map(escapeCsv).join(',');
  const body = result.rows.map((row) =>
    result.columns
      .map((col) => {
        const raw = exportValue(row[col]);
        return escapeCsv(raw === null ? '' : String(raw));
      })
      .join(',')
  );

  const csv = `\uFEFF${header}\n${body.join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${defaultBaseName(baseName)}.csv`);
}

export function exportResultToExcel(result: QueryResult, baseName?: string): void {
  const data = result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of result.columns) {
      obj[col] = exportValue(row[col]);
    }
    return obj;
  });

  const sheet = XLSX.utils.json_to_sheet(data, { header: result.columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Resultados');
  XLSX.writeFile(workbook, `${defaultBaseName(baseName)}.xlsx`);
}
