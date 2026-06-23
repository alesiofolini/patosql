import { dbManager } from './connection';

export interface TableInfo {
  schema: string;
  name: string;
  type: 'BASE TABLE' | 'VIEW' | string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

export async function fetchSchemas(): Promise<string[]> {
  const rows = await dbManager.query<{ schema_name: string }>(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
     ORDER BY schema_name`
  );
  return rows.map((r) => r.schema_name);
}

export async function fetchTables(schema = 'main'): Promise<TableInfo[]> {
  const rows = await dbManager.query<{ table_schema: string; table_name: string; table_type: string }>(
    `SELECT table_schema, table_name, table_type
     FROM information_schema.tables
     WHERE table_schema = '${schema.replace(/'/g, "''")}'
     ORDER BY table_name`
  );
  return rows.map((r) => ({
    schema: r.table_schema,
    name: r.table_name,
    type: r.table_type,
  }));
}

export async function fetchColumns(schema: string, table: string): Promise<ColumnInfo[]> {
  const rows = await dbManager.query<{ column_name: string; data_type: string; is_nullable: string }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = '${schema.replace(/'/g, "''")}'
       AND table_name = '${table.replace(/'/g, "''")}'
     ORDER BY ordinal_position`
  );
  return rows.map((r) => ({
    name: r.column_name,
    type: r.data_type,
    nullable: r.is_nullable === 'YES',
  }));
}

export async function fetchTablePreview(schema: string, table: string, limit = 100): Promise<Record<string, unknown>[]> {
  const qualified = `"${schema}"."${table}"`;
  return dbManager.query(`SELECT * FROM ${qualified} LIMIT ${limit}`);
}

export function buildSelectTop(schema: string, table: string, limit = 100): string {
  return `SELECT * FROM "${schema}"."${table}" LIMIT ${limit};`;
}

export function buildDescribe(schema: string, table: string): string {
  return `DESCRIBE "${schema}"."${table}";`;
}
