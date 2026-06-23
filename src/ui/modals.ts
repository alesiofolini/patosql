import { guessFormat, guessTableName, listExcelSheets, type ImportFormat } from '../db/import';

export interface ConnectChoice {
  type: 'memory' | 'open' | 'create';
  file?: File;
  dbName?: string;
}

export function showConnectModal(): Promise<ConnectChoice | null> {
  return new Promise((resolve) => {
    const overlay = createOverlay();
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-labelledby="connect-title">
        <h3 id="connect-title">Conectar a DuckDB</h3>
        <p class="modal-desc">Elegí cómo querés trabajar con la base de datos.</p>
        <div class="modal-options">
          <button type="button" class="modal-option" data-type="memory">
            <span class="modal-option-icon">⚡</span>
            <strong>En memoria</strong>
            <span>Sesión temporal, ideal para pruebas rápidas</span>
          </button>
          <button type="button" class="modal-option" data-type="open">
            <span class="modal-option-icon">📂</span>
            <strong>Abrir archivo .duckdb</strong>
            <span>Cargar una base existente desde tu disco</span>
          </button>
          <button type="button" class="modal-option" data-type="create">
            <span class="modal-option-icon">✨</span>
            <strong>Nueva base de datos</strong>
            <span>Crear un archivo .duckdb nuevo</span>
          </button>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-action="cancel">Cancelar</button>
        </div>
        <input type="file" id="open-db-input" accept=".duckdb" hidden />
      </div>
    `;

    document.body.appendChild(overlay);

    const fileInput = overlay.querySelector('#open-db-input') as HTMLInputElement;

    const close = (value: ConnectChoice | null) => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector('[data-action="cancel"]')!.addEventListener('click', () => close(null));

    overlay.querySelector('[data-type="memory"]')!.addEventListener('click', () => {
      close({ type: 'memory' });
    });

    overlay.querySelector('[data-type="open"]')!.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) close({ type: 'open', file });
      else close(null);
    });

    overlay.querySelector('[data-type="create"]')!.addEventListener('click', () => {
      overlay.remove();
      void showCreateDbModal().then(resolve);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
  });
}

export function showCreateDbModal(): Promise<ConnectChoice | null> {
  return new Promise((resolve) => {
    const overlay = createOverlay();
    overlay.innerHTML = `
      <div class="modal" role="dialog">
        <h3>Nueva base de datos</h3>
        <p class="modal-desc">Ingresá un nombre para el archivo .duckdb</p>
        <label class="field">
          <span>Nombre</span>
          <input type="text" id="new-db-name" value="mi_base" placeholder="mi_base" />
        </label>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-action="cancel">Cancelar</button>
          <button type="button" class="btn btn-primary" data-action="create">Crear</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#new-db-name') as HTMLInputElement;
    input.focus();
    input.select();

    const close = (value: ConnectChoice | null) => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector('[data-action="cancel"]')!.addEventListener('click', () => close(null));
    overlay.querySelector('[data-action="create"]')!.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) return;
      close({ type: 'create', dbName: name });
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const name = input.value.trim();
        if (name) close({ type: 'create', dbName: name });
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
  });
}

export interface ImportModalResult {
  file: File;
  tableName: string;
  format: ImportFormat;
  header: boolean;
  delimiter: string;
  replaceIfExists: boolean;
  sheetName?: string;
}

export function showImportModal(initialFile?: File): Promise<ImportModalResult | null> {
  return new Promise((resolve) => {
    const overlay = createOverlay();
    const fileName = initialFile?.name ?? '';
    const defaultTable = fileName ? guessTableName(fileName) : 'nueva_tabla';
    const defaultFormat = fileName ? guessFormat(fileName) : 'csv';

    overlay.innerHTML = `
      <div class="modal modal-wide" role="dialog">
        <h3>Importar archivo a tabla</h3>
        <p class="modal-desc">CSV, Excel, Parquet o JSON → tabla en DuckDB</p>
        <label class="field">
          <span>Archivo</span>
          <div class="file-row">
            <input type="file" id="import-file" accept=".csv,.tsv,.txt,.parquet,.json,.jsonl,.ndjson,.xlsx,.xls" />
            <span class="file-name" id="import-file-name">${fileName || 'Ningún archivo'}</span>
          </div>
        </label>
        <label class="field field-excel hidden" id="import-sheet-field">
          <span>Hoja de Excel</span>
          <select id="import-sheet"></select>
        </label>
        <label class="field">
          <span>Nombre de tabla</span>
          <input type="text" id="import-table" value="${defaultTable}" />
        </label>
        <div class="field-row">
          <label class="field">
            <span>Formato</span>
            <select id="import-format">
              <option value="csv" ${defaultFormat === 'csv' ? 'selected' : ''}>CSV / TSV</option>
              <option value="excel" ${defaultFormat === 'excel' ? 'selected' : ''}>Excel (.xlsx / .xls)</option>
              <option value="parquet" ${defaultFormat === 'parquet' ? 'selected' : ''}>Parquet</option>
              <option value="json" ${defaultFormat === 'json' ? 'selected' : ''}>JSON</option>
            </select>
          </label>
          <label class="field field-csv" id="import-delim-field">
            <span>Delimitador (CSV)</span>
            <input type="text" id="import-delim" value="," maxlength="3" />
          </label>
        </div>
        <label class="checkbox-field field-csv" id="import-header-field">
          <input type="checkbox" id="import-header" checked />
          Primera fila es encabezado (CSV)
        </label>
        <label class="checkbox-field">
          <input type="checkbox" id="import-replace" />
          Reemplazar tabla si ya existe
        </label>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-action="cancel">Cancelar</button>
          <button type="button" class="btn btn-primary" data-action="import">Importar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const fileInput = overlay.querySelector('#import-file') as HTMLInputElement;
    const fileNameEl = overlay.querySelector('#import-file-name')!;
    const tableInput = overlay.querySelector('#import-table') as HTMLInputElement;
    const formatSelect = overlay.querySelector('#import-format') as HTMLSelectElement;
    const sheetField = overlay.querySelector('#import-sheet-field') as HTMLElement;
    const sheetSelect = overlay.querySelector('#import-sheet') as HTMLSelectElement;
    const csvFields = overlay.querySelectorAll('.field-csv');

    let selectedFile = initialFile ?? null;
    let selectedSheet = '';

    const updateFormatUI = (format: string) => {
      const isExcel = format === 'excel';
      const isCsv = format === 'csv';
      sheetField.classList.toggle('hidden', !isExcel);
      csvFields.forEach((el) => el.classList.toggle('hidden', !isCsv));
    };

    const loadExcelSheets = async (file: File) => {
      sheetSelect.innerHTML = '<option>Cargando hojas...</option>';
      try {
        const sheets = await listExcelSheets(file);
        sheetSelect.innerHTML = sheets
          .map((s) => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`)
          .join('');
        selectedSheet = sheets[0] ?? '';
        if (selectedSheet) {
          tableInput.value = guessTableName(file.name, selectedSheet);
        }
      } catch (err) {
        sheetSelect.innerHTML = '';
        alert(`No se pudo leer el Excel: ${(err as Error).message}`);
      }
    };

    updateFormatUI(formatSelect.value);

    if (initialFile) {
      const dt = new DataTransfer();
      dt.items.add(initialFile);
      fileInput.files = dt.files;
      if (guessFormat(initialFile.name) === 'excel') {
        void loadExcelSheets(initialFile);
      }
    }

    formatSelect.addEventListener('change', () => {
      updateFormatUI(formatSelect.value);
      if (formatSelect.value === 'excel' && selectedFile) {
        void loadExcelSheets(selectedFile);
      }
    });

    fileInput.addEventListener('change', () => {
      selectedFile = fileInput.files?.[0] ?? null;
      fileNameEl.textContent = selectedFile?.name ?? 'Ningún archivo';
      if (selectedFile) {
        const format = guessFormat(selectedFile.name);
        formatSelect.value = format;
        updateFormatUI(format);
        if (format === 'excel') {
          void loadExcelSheets(selectedFile);
        } else {
          tableInput.value = guessTableName(selectedFile.name);
        }
      }
    });

    sheetSelect.addEventListener('change', () => {
      selectedSheet = sheetSelect.value;
      if (selectedFile && selectedSheet) {
        tableInput.value = guessTableName(selectedFile.name, selectedSheet);
      }
    });

    const close = (value: ImportModalResult | null) => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector('[data-action="cancel"]')!.addEventListener('click', () => close(null));
    overlay.querySelector('[data-action="import"]')!.addEventListener('click', () => {
      if (!selectedFile) {
        alert('Seleccioná un archivo');
        return;
      }
      close({
        file: selectedFile,
        tableName: tableInput.value.trim(),
        format: formatSelect.value as ImportFormat,
        header: (overlay.querySelector('#import-header') as HTMLInputElement).checked,
        delimiter: (overlay.querySelector('#import-delim') as HTMLInputElement).value || ',',
        replaceIfExists: (overlay.querySelector('#import-replace') as HTMLInputElement).checked,
        sheetName: formatSelect.value === 'excel' ? (sheetSelect.value || selectedSheet) : undefined,
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
  });
}

export function showSaveDbModal(defaultName = 'database'): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = createOverlay();
    overlay.innerHTML = `
      <div class="modal" role="dialog">
        <h3>Guardar base de datos</h3>
        <p class="modal-desc">Elegí el nombre del archivo .duckdb a descargar</p>
        <label class="field">
          <span>Nombre</span>
          <input type="text" id="save-db-name" value="${escapeAttr(defaultName)}" placeholder="mi_base" />
        </label>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-action="cancel">Cancelar</button>
          <button type="button" class="btn btn-primary" data-action="save">Descargar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#save-db-name') as HTMLInputElement;
    input.focus();
    input.select();

    const close = (value: string | null) => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector('[data-action="cancel"]')!.addEventListener('click', () => close(null));
    overlay.querySelector('[data-action="save"]')!.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) return;
      close(name);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const name = input.value.trim();
        if (name) close(name);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
  });
}

function createOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  return overlay;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
