import { dbManager } from './connection';

export interface CachedTable {
  schema: string;
  name: string;
  type: string;
}

export interface CachedColumn {
  name: string;
  type: string;
}

export interface SchemaCache {
  tables: CachedTable[];
  columnsByTable: Map<string, CachedColumn[]>;
}

const EMPTY_CACHE: SchemaCache = { tables: [], columnsByTable: new Map() };

let cache: SchemaCache = { tables: [], columnsByTable: new Map() };

function tableKey(schema: string, table: string): string {
  return `${schema}.${table}`;
}

export function getSchemaCache(): SchemaCache {
  return cache;
}

export function clearSchemaCache(): void {
  cache = { tables: [], columnsByTable: new Map() };
}

export async function refreshSchemaCache(): Promise<void> {
  if (!dbManager.isConnected) {
    clearSchemaCache();
    return;
  }

  try {
    const tableRows = await dbManager.query<{
      table_schema: string;
      table_name: string;
      table_type: string;
    }>(
      `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
       WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
       ORDER BY table_schema, table_name`
    );

    const colRows = await dbManager.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
      data_type: string;
    }>(
      `SELECT table_schema, table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
       ORDER BY table_schema, table_name, ordinal_position`
    );

    const columnsByTable = new Map<string, CachedColumn[]>();
    for (const row of colRows) {
      const key = tableKey(row.table_schema, row.table_name);
      const cols = columnsByTable.get(key) ?? [];
      cols.push({ name: row.column_name, type: row.data_type });
      columnsByTable.set(key, cols);
    }

    cache = {
      tables: tableRows.map((r) => ({
        schema: r.table_schema,
        name: r.table_name,
        type: r.table_type,
      })),
      columnsByTable,
    };
  } catch {
    cache = EMPTY_CACHE;
  }
}

export function findTable(schema: string | null, name: string): CachedTable | undefined {
  const lower = name.toLowerCase();
  return cache.tables.find(
    (t) => t.name.toLowerCase() === lower && (!schema || t.schema.toLowerCase() === schema.toLowerCase())
  );
}

export function getColumns(schema: string, table: string): CachedColumn[] {
  return cache.columnsByTable.get(tableKey(schema, table)) ?? [];
}

export function findColumnsForTableName(tableName: string): CachedColumn[] {
  const lower = tableName.toLowerCase();
  for (const [key, cols] of cache.columnsByTable) {
    const table = key.split('.').pop() ?? '';
    if (table.toLowerCase() === lower) return cols;
  }
  return [];
}
