import * as XLSX from 'xlsx';
import { dbManager } from './connection';

export type ImportFormat = 'csv' | 'parquet' | 'json' | 'excel';

export interface ImportOptions {
  file: File;
  tableName: string;
  schema?: string;
  format: ImportFormat;
  header?: boolean;
  delimiter?: string;
  replaceIfExists?: boolean;
  sheetName?: string;
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'imported_table';
}

function isExcelFile(fileName: string): boolean {
  return /\.(xlsx|xls)$/i.test(fileName);
}

function detectFormat(fileName: string): ImportFormat | null {
  const lower = fileName.toLowerCase();
  if (isExcelFile(lower)) return 'excel';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) return 'csv';
  if (lower.endsWith('.parquet')) return 'parquet';
  if (lower.endsWith('.json') || lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) return 'json';
  return null;
}

export function guessTableName(fileName: string, sheetName?: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  if (sheetName && sheetName !== 'Sheet1') {
    return sanitizeIdentifier(`${base}_${sheetName}`);
  }
  return sanitizeIdentifier(base);
}

export function guessFormat(fileName: string): ImportFormat {
  return detectFormat(fileName) ?? 'csv';
}

export async function listExcelSheets(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return workbook.SheetNames;
}

async function importExcel(options: ImportOptions): Promise<string> {
  const { file, tableName, schema = 'main', sheetName, replaceIfExists = false } = options;
  const safeTable = sanitizeIdentifier(tableName);
  const qualified = `"${schema}"."${safeTable}"`;
  const db = dbManager.getDatabase();
  const conn = dbManager.getConnection();

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const selectedSheet = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0];

  if (!selectedSheet) {
    throw new Error('El archivo Excel no tiene hojas');
  }

  const sheet = workbook.Sheets[selectedSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error(`La hoja "${selectedSheet}" está vacía`);
  }

  const virtualName = `__import_${Date.now()}_${file.name}.json`;
  const jsonText = JSON.stringify(rows);
  await db.registerFileText(virtualName, jsonText);

  if (replaceIfExists) {
    await conn.query(`DROP TABLE IF EXISTS ${qualified}`);
  }

  await conn.insertJSONFromPath(virtualName, { schema, name: safeTable });

  try {
    await db.dropFile(virtualName);
  } catch {
    // best-effort cleanup
  }

  return `-- Importado desde ${file.name} (hoja: ${selectedSheet})\nCREATE TABLE ${qualified} ... (${rows.length} filas)`;
}

export async function importFile(options: ImportOptions): Promise<{ rowCount: number; sql: string }> {
  const {
    file,
    tableName,
    schema = 'main',
    format,
    header = true,
    delimiter,
    replaceIfExists = false,
  } = options;

  const safeTable = sanitizeIdentifier(tableName);
  const virtualName = `__import_${Date.now()}_${file.name}`;
  const db = dbManager.getDatabase();
  const conn = dbManager.getConnection();
  const qualified = `"${schema}"."${safeTable}"`;

  if (format === 'excel') {
    const sql = await importExcel(options);
    const countResult = await conn.query(`SELECT COUNT(*) AS cnt FROM ${qualified}`);
    const rowCount = Number(countResult.toArray()[0]?.toJSON().cnt ?? 0);
    return { rowCount, sql };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  await db.registerFileBuffer(virtualName, buffer);

  if (replaceIfExists) {
    await conn.query(`DROP TABLE IF EXISTS ${qualified}`);
  }

  let sql: string;

  switch (format) {
    case 'csv': {
      const delim = delimiter ?? (file.name.toLowerCase().endsWith('.tsv') ? '\t' : ',');
      await conn.insertCSVFromPath(virtualName, {
        schema,
        name: safeTable,
        header,
        delimiter: delim,
        detect: true,
      });
      sql = `-- Importado desde ${file.name}\nCREATE TABLE ${qualified} ... (via read_csv_auto)`;
      break;
    }
    case 'parquet': {
      sql = `CREATE TABLE ${qualified} AS SELECT * FROM read_parquet('${virtualName}');`;
      await conn.query(sql);
      break;
    }
    case 'json': {
      const isJsonl = /\.(jsonl|ndjson)$/i.test(file.name);
      if (isJsonl) {
        sql = `CREATE TABLE ${qualified} AS SELECT * FROM read_json_auto('${virtualName}', format='newline_delimited');`;
        await conn.query(sql);
      } else {
        await conn.insertJSONFromPath(virtualName, { schema, name: safeTable });
        sql = `-- Importado desde ${file.name}\nCREATE TABLE ${qualified} ... (via read_json_auto)`;
      }
      break;
    }
    default:
      throw new Error(`Formato no soportado: ${format}`);
  }

  const countResult = await conn.query(`SELECT COUNT(*) AS cnt FROM ${qualified}`);
  const rowCount = Number(countResult.toArray()[0]?.toJSON().cnt ?? 0);

  try {
    await db.dropFile(virtualName);
  } catch {
    // best-effort cleanup
  }

  return { rowCount, sql };
}
