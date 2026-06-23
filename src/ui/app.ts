import { dbManager } from '../db/connection';
import { importFile } from '../db/import';
import { clearSchemaCache, refreshSchemaCache } from '../db/schema-cache';
import { QueryTabManager } from './query-tabs';
import { Sidebar } from './sidebar';
import { ResultsPanel, type TabResultState } from './results';
import { showConnectModal, showImportModal, showSaveDbModal } from './modals';

export class App {
  private root: HTMLElement;
  private statusEl!: HTMLElement;
  private queryTabs!: QueryTabManager;
  private sidebar!: Sidebar;
  private results!: ResultsPanel;

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
    void this.boot();
  }

  private render(): void {
    this.root.innerHTML = `
      <header class="toolbar">
        <div class="toolbar-brand">
          <span class="brand-icon">🦆</span>
          <div>
            <strong>PatoSQL</strong>
            <span class="brand-sub">GUI SQL con DuckDB</span>
          </div>
        </div>
        <div class="toolbar-actions">
          <button type="button" class="btn" id="btn-connect">Conectar</button>
          <button type="button" class="btn" id="btn-disconnect" disabled>Desconectar</button>
          <button type="button" class="btn" id="btn-import" disabled>Importar archivo</button>
          <button type="button" class="btn" id="btn-save" disabled title="Descargar la base como archivo .duckdb">Guardar .duckdb</button>
          <button type="button" class="btn btn-primary" id="btn-run" disabled>▶ Ejecutar</button>
        </div>
        <div class="toolbar-status" id="connection-status">Inicializando...</div>
      </header>
      <main class="workspace">
        <div class="workspace-left" id="sidebar-host"></div>
        <div class="workspace-main">
          <div class="editor-toolbar">
            <span>Consultas SQL</span>
            <span class="hint">Ctrl+Enter ejecutar · Ctrl+Space autocompletar · + nueva pestaña</span>
          </div>
          <div class="query-tabs-bar" id="query-tabs-bar"></div>
          <div class="editor-host" id="editor-host"></div>
          <div class="results-host" id="results-host"></div>
        </div>
      </main>
    `;

    this.statusEl = this.root.querySelector('#connection-status')!;

    const sidebarHost = this.root.querySelector('#sidebar-host') as HTMLElement;
    const resultsHost = this.root.querySelector('#results-host') as HTMLElement;
    const tabBar = this.root.querySelector('#query-tabs-bar') as HTMLElement;
    const editorHost = this.root.querySelector('#editor-host') as HTMLElement;

    this.queryTabs = new QueryTabManager(tabBar, editorHost);
    this.results = new ResultsPanel(resultsHost);
    this.sidebar = new Sidebar(sidebarHost, {
      onSelectQuery: (sql) => {
        this.queryTabs.setActiveSql(sql);
      },
      onRefresh: () => {
        void refreshSchemaCache();
      },
    });

    this.queryTabs.onTabChange((tab) => {
      this.results.setExportBaseName(tab.title);
      this.results.applyState(tab.result);
    });

    this.queryTabs.onRun(() => void this.runQuery());

    this.root.querySelector('#btn-connect')!.addEventListener('click', () => void this.handleConnect());
    this.root.querySelector('#btn-disconnect')!.addEventListener('click', () => void this.handleDisconnect());
    this.root.querySelector('#btn-import')!.addEventListener('click', () => void this.handleImport());
    this.root.querySelector('#btn-save')!.addEventListener('click', () => void this.handleSave());
    this.root.querySelector('#btn-run')!.addEventListener('click', () => void this.runQuery());
  }

  private async boot(): Promise<void> {
    this.setStatus('Listo — conectá a una base para empezar');
    const choice = await showConnectModal();
    if (choice) await this.applyConnection(choice);
  }

  private setConnectedUI(connected: boolean): void {
    (this.root.querySelector('#btn-disconnect') as HTMLButtonElement).disabled = !connected;
    (this.root.querySelector('#btn-import') as HTMLButtonElement).disabled = !connected;
    (this.root.querySelector('#btn-run') as HTMLButtonElement).disabled = !connected;
    (this.root.querySelector('#btn-save') as HTMLButtonElement).disabled = !connected;
  }

  private setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  private async refreshMetadata(): Promise<void> {
    await refreshSchemaCache();
    await this.sidebar.refresh();
  }

  private async handleConnect(): Promise<void> {
    const choice = await showConnectModal();
    if (choice) await this.applyConnection(choice);
  }

  private async applyConnection(choice: { type: string; file?: File; dbName?: string }): Promise<void> {
    try {
      this.setStatus('Conectando...');
      if (choice.type === 'memory') {
        await dbManager.connectInMemory();
        this.setStatus('Conectado: en memoria');
      } else if (choice.type === 'open' && choice.file) {
        await dbManager.connectToFile(choice.file);
        this.setStatus(`Conectado: ${choice.file.name}`);
      } else if (choice.type === 'create' && choice.dbName) {
        await dbManager.createNewDatabase(choice.dbName);
        this.setStatus(`Nueva base: ${choice.dbName}`);
      }
      this.setConnectedUI(true);
      await this.refreshMetadata();
      this.queryTabs.focus();
    } catch (err) {
      this.setStatus('Error de conexión');
      this.showOnActiveTab({ kind: 'message', message: (err as Error).message, type: 'error' });
      this.setConnectedUI(false);
    }
  }

  private async handleDisconnect(): Promise<void> {
    await dbManager.disconnect();
    clearSchemaCache();
    this.setConnectedUI(false);
    this.setStatus('Desconectado');
    this.queryTabs.clearAllResults();
    const active = this.queryTabs.getActiveTab();
    if (active) this.results.applyState(active.result);
    else this.results.clear();
    await this.refreshMetadata();
  }

  private showOnActiveTab(state: TabResultState): void {
    const tabId = this.queryTabs.getActiveTabId();
    this.queryTabs.setTabResult(tabId, state);
    this.results.applyState(state);
  }

  private async handleImport(): Promise<void> {
    const options = await showImportModal();
    if (!options) return;

    try {
      this.setStatus('Importando...');
      const { rowCount } = await importFile({
        file: options.file,
        tableName: options.tableName,
        format: options.format,
        header: options.header,
        delimiter: options.delimiter,
        replaceIfExists: options.replaceIfExists,
        sheetName: options.sheetName,
      });
      this.setStatus(`Importado: ${options.tableName} (${rowCount} filas)`);
      this.showOnActiveTab({
        kind: 'message',
        message: `Tabla "${options.tableName}" creada con ${rowCount} filas.`,
        type: 'ok',
      });
      await this.refreshMetadata();
    } catch (err) {
      this.showOnActiveTab({ kind: 'message', message: (err as Error).message, type: 'error' });
      this.setStatus('Error al importar');
    }
  }

  private async handleSave(): Promise<void> {
    try {
      const info = dbManager.connectionInfo;
      let downloadName = info.fileName?.replace(/\.duckdb$/i, '') ?? 'database';

      if (info.mode === 'memory') {
        const chosen = await showSaveDbModal(downloadName);
        if (!chosen) return;
        downloadName = chosen;
      }

      this.setStatus('Guardando...');
      const exported = await dbManager.exportDatabase(downloadName);
      if (!exported) {
        this.showOnActiveTab({
          kind: 'message',
          message: 'No se pudo exportar la base de datos.',
          type: 'error',
        });
        return;
      }

      const { blob, fileName } = exported;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      this.setStatus(`Guardado: ${fileName}`);
      this.showOnActiveTab({ kind: 'message', message: `Base descargada como ${fileName}`, type: 'ok' });
    } catch (err) {
      this.showOnActiveTab({ kind: 'message', message: (err as Error).message, type: 'error' });
      this.setStatus('Error al guardar');
    }
  }

  private async runQuery(): Promise<void> {
    if (!dbManager.isConnected) return;

    const tabId = this.queryTabs.getActiveTabId();
    const { selected, full } = this.queryTabs.getActiveSql();
    const sql = selected || full;
    if (!sql) return;

    const loading: TabResultState = { kind: 'loading' };
    this.queryTabs.setTabResult(tabId, loading);
    this.results.applyState(loading);
    const start = performance.now();

    try {
      const outcome = await dbManager.execute(sql);
      const durationMs = Math.round(performance.now() - start);

      let state: TabResultState;
      if (outcome.type === 'ok') {
        state = {
          kind: 'message',
          message: `${outcome.message} (${durationMs} ms)`,
          type: 'ok',
        };
        await this.refreshMetadata();
      } else {
        state = {
          kind: 'data',
          result: {
            columns: outcome.columns,
            rows: outcome.rows,
            rowCount: outcome.rowCount,
            durationMs,
          },
        };
      }

      this.queryTabs.setTabResult(tabId, state);
      if (this.queryTabs.getActiveTabId() === tabId) {
        this.results.applyState(state);
      }
      this.queryTabs.focus();
    } catch (err) {
      const state: TabResultState = {
        kind: 'message',
        message: (err as Error).message,
        type: 'error',
      };
      this.queryTabs.setTabResult(tabId, state);
      if (this.queryTabs.getActiveTabId() === tabId) {
        this.results.applyState(state);
      }
    }
  }
}
