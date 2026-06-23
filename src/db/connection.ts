import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

export type ConnectionMode = 'memory' | 'file';

export interface ConnectionInfo {
  mode: ConnectionMode;
  path: string;
  displayName: string;
  fileName?: string;
}

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_wasm, mainWorker: mvp_worker },
  eh: { mainModule: duckdb_wasm_eh, mainWorker: eh_worker },
};

const INIT_TIMEOUT_MS = 90_000;

export class DuckDBManager {
  private db: AsyncDuckDB | null = null;
  private conn: AsyncDuckDBConnection | null = null;
  private dbOpened = false;
  private info: ConnectionInfo = {
    mode: 'memory',
    path: ':memory:',
    displayName: 'Desconectado',
  };

  get connectionInfo(): ConnectionInfo {
    return { ...this.info };
  }

  get isConnected(): boolean {
    return this.conn !== null;
  }

  async initialize(): Promise<void> {
    if (this.db) return;

    const init = async () => {
      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('DuckDB no respondió a tiempo. Reiniciá la app e intentá de nuevo.')),
        INIT_TIMEOUT_MS
      );
    });

    try {
      await Promise.race([init(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async connectInMemory(): Promise<void> {
    await this.initialize();
    await this.reopenDatabase(':memory:');
    this.conn = await this.db!.connect();
    this.info = { mode: 'memory', path: ':memory:', displayName: 'En memoria' };
  }

  async connectToFile(file: File): Promise<void> {
    await this.initialize();

    const fileName = file.name.endsWith('.duckdb') ? file.name : `${file.name}.duckdb`;
    const buffer = new Uint8Array(await file.arrayBuffer());

    await this.db!.registerFileBuffer(fileName, buffer);
    await this.reopenDatabase(fileName);
    this.conn = await this.db!.connect();
    this.info = {
      mode: 'file',
      path: fileName,
      displayName: fileName,
      fileName,
    };
  }

  async createNewDatabase(fileName: string): Promise<void> {
    await this.initialize();

    const safeName = fileName.endsWith('.duckdb') ? fileName : `${fileName}.duckdb`;
    await this.reopenDatabase(safeName);
    this.conn = await this.db!.connect();
    this.info = {
      mode: 'file',
      path: safeName,
      displayName: safeName,
      fileName: safeName,
    };
  }

  async disconnect(): Promise<void> {
    await this.closeConnection();
    if (this.db) {
      await this.db.terminate();
      this.db = null;
      this.dbOpened = false;
    }
    this.info = { mode: 'memory', path: ':memory:', displayName: 'Desconectado' };
  }

  private async reopenDatabase(dbPath: string): Promise<void> {
    await this.closeConnection();
    if (!this.db) throw new Error('DuckDB no inicializado');

    if (this.dbOpened) {
      try {
        await this.db.reset();
      } catch {
        // reset can fail if the engine is already clean
      }
      this.dbOpened = false;
    }

    await this.db.open({ path: dbPath });
    this.dbOpened = true;
  }

  private async closeConnection(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
  }

  getConnection(): AsyncDuckDBConnection {
    if (!this.conn) throw new Error('No hay conexión activa');
    return this.conn;
  }

  getDatabase(): AsyncDuckDB {
    if (!this.db) throw new Error('DuckDB no inicializado');
    return this.db;
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const conn = this.getConnection();
    const result = await conn.query(sql);
    return result.toArray().map((row) => row.toJSON() as T);
  }

  async execute(sql: string): Promise<{ type: 'result'; rows: Record<string, unknown>[]; columns: string[]; rowCount: number } | { type: 'ok'; message: string }> {
    const trimmed = sql.trim();
    if (!trimmed) {
      throw new Error('La consulta está vacía');
    }

    const conn = this.getConnection();
    const upper = trimmed.toUpperCase();

    const isSelectLike =
      upper.startsWith('SELECT') ||
      upper.startsWith('WITH') ||
      upper.startsWith('DESCRIBE') ||
      upper.startsWith('SHOW') ||
      upper.startsWith('PRAGMA') ||
      upper.startsWith('EXPLAIN');

    if (isSelectLike) {
      const result = await conn.query(trimmed);
      const rows = result.toArray().map((row) => row.toJSON() as Record<string, unknown>);
      const schema = result.schema;
      const columns = schema.fields.map((f) => f.name);
      return { type: 'result', rows, columns, rowCount: rows.length };
    }

    await conn.query(trimmed);
    return { type: 'ok', message: 'Comando ejecutado correctamente.' };
  }

  async exportDatabase(downloadName?: string): Promise<{ blob: Blob; fileName: string } | null> {
    if (!this.db || !this.conn) return null;

    const defaultName = downloadName ?? this.info.fileName ?? 'database.duckdb';
    const fileName = defaultName.endsWith('.duckdb') ? defaultName : `${defaultName}.duckdb`;

    if (this.info.mode === 'file' && this.info.fileName) {
      try {
        await this.conn.query('CHECKPOINT');
      } catch {
        // checkpoint may not be available in all modes
      }
      const buffer = await this.db.copyFileToBuffer(this.info.fileName);
      return { blob: new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' }), fileName };
    }

    const exportPath = `__export_${Date.now()}.duckdb`;
    try {
      await this.conn.query(`ATTACH '${exportPath}' AS export_db`);

      const tables = await this.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'main' AND table_type = 'BASE TABLE'
         ORDER BY table_name`
      );

      for (const { table_name } of tables) {
        const escaped = table_name.replace(/"/g, '""');
        await this.conn.query(
          `CREATE TABLE export_db.main."${escaped}" AS SELECT * FROM main."${escaped}"`
        );
      }

      await this.conn.query('DETACH export_db');

      const buffer = await this.db.copyFileToBuffer(exportPath);
      return { blob: new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' }), fileName };
    } finally {
      try {
        await this.db.dropFile(exportPath);
      } catch {
        // best-effort cleanup
      }
    }
  }
}

export const dbManager = new DuckDBManager();
