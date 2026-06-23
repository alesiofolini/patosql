import { exportResultToCsv, exportResultToExcel } from '../utils/export-results';

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

export type TabResultState =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'message'; message: string; type: 'ok' | 'error' }
  | { kind: 'data'; result: QueryResult };

export class ResultsPanel {
  private el: HTMLElement;
  private statusEl: HTMLElement;
  private gridEl: HTMLElement;
  private messagesEl: HTMLElement;
  private actionsEl: HTMLElement;
  private currentResult: QueryResult | null = null;
  private exportBaseName = 'resultados';

  constructor(container: HTMLElement) {
    this.el = document.createElement('section');
    this.el.className = 'results-panel';
    this.el.innerHTML = `
      <div class="results-header">
        <span class="results-title">Resultados</span>
        <div class="results-actions hidden" id="results-actions">
          <button type="button" class="btn btn-sm" id="btn-export-csv" title="Exportar a CSV">CSV</button>
          <button type="button" class="btn btn-sm" id="btn-export-xlsx" title="Exportar a Excel">Excel</button>
        </div>
        <span class="results-status" id="results-status">Listo</span>
      </div>
      <div class="results-messages" id="results-messages"></div>
      <div class="results-grid-wrap" id="results-grid"></div>
    `;
    container.appendChild(this.el);
    this.statusEl = this.el.querySelector('#results-status')!;
    this.gridEl = this.el.querySelector('#results-grid')!;
    this.messagesEl = this.el.querySelector('#results-messages')!;
    this.actionsEl = this.el.querySelector('#results-actions')!;

    this.el.querySelector('#btn-export-csv')!.addEventListener('click', () => {
      if (this.currentResult) exportResultToCsv(this.currentResult, this.exportBaseName);
    });
    this.el.querySelector('#btn-export-xlsx')!.addEventListener('click', () => {
      if (this.currentResult) exportResultToExcel(this.currentResult, this.exportBaseName);
    });
  }

  setExportBaseName(name: string): void {
    this.exportBaseName = name || 'resultados';
  }

  private setExportVisible(visible: boolean): void {
    this.actionsEl.classList.toggle('hidden', !visible);
    if (!visible) this.currentResult = null;
  }

  setLoading(): void {
    this.statusEl.textContent = 'Ejecutando...';
    this.messagesEl.innerHTML = '';
    this.gridEl.innerHTML = '<div class="results-loading">Ejecutando consulta...</div>';
    this.setExportVisible(false);
  }

  showMessage(message: string, type: 'ok' | 'error' = 'ok'): void {
    this.statusEl.textContent = type === 'error' ? 'Error' : 'OK';
    this.messagesEl.innerHTML = `<div class="result-message result-message--${type}">${escapeHtml(message)}</div>`;
    this.gridEl.innerHTML = '';
    this.setExportVisible(false);
  }

  showResult(result: QueryResult): void {
    this.currentResult = result;
    this.statusEl.textContent = `${result.rowCount} fila(s) · ${result.durationMs} ms`;
    this.messagesEl.innerHTML = '';
    this.setExportVisible(result.columns.length > 0 && result.rows.length >= 0);

    if (result.columns.length === 0) {
      this.gridEl.innerHTML = '<div class="results-empty">Sin columnas</div>';
      this.setExportVisible(false);
      return;
    }

    const table = document.createElement('table');
    table.className = 'results-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const col of result.columns) {
      const th = document.createElement('th');
      th.textContent = col;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of result.rows) {
      const tr = document.createElement('tr');
      for (const col of result.columns) {
        const td = document.createElement('td');
        td.textContent = formatCell(row[col]);
        td.title = formatCell(row[col]);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.gridEl.innerHTML = '';
    this.gridEl.appendChild(table);
  }

  clear(): void {
    this.statusEl.textContent = 'Listo';
    this.messagesEl.innerHTML = '';
    this.gridEl.innerHTML = '';
    this.setExportVisible(false);
  }

  applyState(state: TabResultState): void {
    switch (state.kind) {
      case 'empty':
        this.clear();
        break;
      case 'loading':
        this.setLoading();
        break;
      case 'message':
        this.showMessage(state.message, state.type);
        break;
      case 'data':
        this.showResult(state.result);
        break;
    }
  }
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
