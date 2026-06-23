import { fetchTables, fetchColumns, type TableInfo, type ColumnInfo } from '../db/metadata';

export interface SidebarCallbacks {
  onSelectQuery: (sql: string) => void;
  onRefresh: () => void;
}

export class Sidebar {
  private el: HTMLElement;
  private treeEl: HTMLElement;
  private callbacks: SidebarCallbacks;
  private expanded = new Set<string>();

  constructor(container: HTMLElement, callbacks: SidebarCallbacks) {
    this.callbacks = callbacks;
    this.el = document.createElement('aside');
    this.el.className = 'sidebar';
    this.el.innerHTML = `
      <div class="sidebar-header">
        <h2>Explorador</h2>
        <button type="button" class="icon-btn" id="btn-refresh-tree" title="Actualizar">↻</button>
      </div>
      <div class="sidebar-tree" id="object-tree"></div>
    `;
    container.appendChild(this.el);
    this.treeEl = this.el.querySelector('#object-tree')!;

    this.el.querySelector('#btn-refresh-tree')!.addEventListener('click', () => {
      void this.refresh();
      this.callbacks.onRefresh();
    });
  }

  async refresh(): Promise<void> {
    this.treeEl.innerHTML = '<div class="tree-loading">Cargando...</div>';
    try {
      const tables = await fetchTables('main');
      this.renderTree(tables);
    } catch (err) {
      this.treeEl.innerHTML = `<div class="tree-error">${(err as Error).message}</div>`;
    }
  }

  private renderTree(tables: TableInfo[]): void {
    if (tables.length === 0) {
      this.treeEl.innerHTML = '<div class="tree-empty">Sin tablas en main</div>';
      return;
    }

    const schemaKey = 'main';
    const isExpanded = this.expanded.has(schemaKey);

    this.treeEl.innerHTML = '';
    const schemaNode = document.createElement('div');
    schemaNode.className = 'tree-node';

    const schemaHeader = document.createElement('button');
    schemaHeader.type = 'button';
    schemaHeader.className = 'tree-item tree-schema';
    schemaHeader.innerHTML = `<span class="tree-chevron">${isExpanded ? '▼' : '▶'}</span> 📁 main`;
    schemaHeader.addEventListener('click', () => {
      if (this.expanded.has(schemaKey)) this.expanded.delete(schemaKey);
      else this.expanded.add(schemaKey);
      void this.refresh();
    });
    schemaNode.appendChild(schemaHeader);

    if (isExpanded) {
      const children = document.createElement('div');
      children.className = 'tree-children';
      for (const table of tables) {
        children.appendChild(this.createTableNode(table));
      }
      schemaNode.appendChild(children);
    }

    this.treeEl.appendChild(schemaNode);
  }

  private createTableNode(table: TableInfo): HTMLElement {
    const key = `${table.schema}.${table.name}`;
    const isExpanded = this.expanded.has(key);
    const isView = table.type === 'VIEW';
    const icon = isView ? '👁' : '📋';

    const wrapper = document.createElement('div');
    wrapper.className = 'tree-node';

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'tree-item tree-table';
    header.innerHTML = `<span class="tree-chevron">${isExpanded ? '▼' : '▶'}</span> ${icon} ${table.name}`;
    header.title = table.type;

    header.addEventListener('click', async () => {
      if (this.expanded.has(key)) {
        this.expanded.delete(key);
        void this.refresh();
        return;
      }
      this.expanded.add(key);
      await this.refresh();
    });

    header.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.callbacks.onSelectQuery(`SELECT * FROM "${table.schema}"."${table.name}" LIMIT 100;`);
    });

    wrapper.appendChild(header);

    if (isExpanded) {
      const children = document.createElement('div');
      children.className = 'tree-children';
      children.innerHTML = '<div class="tree-loading">...</div>';
      wrapper.appendChild(children);

      void fetchColumns(table.schema, table.name).then((cols) => {
        children.innerHTML = '';
        for (const col of cols) {
          children.appendChild(this.createColumnNode(col));
        }
        const actions = document.createElement('div');
        actions.className = 'tree-actions';
        actions.innerHTML = `
          <button type="button" data-action="select">SELECT TOP 100</button>
          <button type="button" data-action="describe">DESCRIBE</button>
        `;
        actions.querySelector('[data-action="select"]')!.addEventListener('click', () => {
          this.callbacks.onSelectQuery(`SELECT * FROM "${table.schema}"."${table.name}" LIMIT 100;`);
        });
        actions.querySelector('[data-action="describe"]')!.addEventListener('click', () => {
          this.callbacks.onSelectQuery(`DESCRIBE "${table.schema}"."${table.name}";`);
        });
        children.appendChild(actions);
      });
    }

    return wrapper;
  }

  private createColumnNode(col: ColumnInfo): HTMLElement {
    const el = document.createElement('div');
    el.className = 'tree-item tree-column';
    const nullMark = col.nullable ? '' : ' NOT NULL';
    el.textContent = `▪ ${col.name} : ${col.type}${nullMark}`;
    el.title = `${col.type}${nullMark}`;
    return el;
  }
}
