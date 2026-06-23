import { createSqlEditor, type SqlEditor } from './editor';
import type { TabResultState } from './results';

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  result: TabResultState;
}

let tabCounter = 1;

function nextTabTitle(): string {
  return `Consulta ${tabCounter++}`;
}

function deriveTitle(sql: string, fallback: string): string {
  const line = sql
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('--'));
  if (!line) return fallback;
  const compact = line.replace(/\s+/g, ' ').slice(0, 40);
  return compact.length < line.replace(/\s+/g, ' ').length ? `${compact}…` : compact;
}

const emptyResult = (): TabResultState => ({ kind: 'empty' });

export class QueryTabManager {
  private tabs: QueryTab[] = [];
  private activeId = '';
  private tabBarEl: HTMLElement;
  private editor: SqlEditor;
  private runHandlers: Array<() => void> = [];
  private tabChangeHandlers: Array<(tab: QueryTab) => void> = [];

  constructor(tabBarContainer: HTMLElement, editorContainer: HTMLElement) {
    this.tabBarEl = tabBarContainer;
    this.editor = createSqlEditor(editorContainer);

    this.editor.onRun(() => {
      this.syncActiveTab();
      this.runHandlers.forEach((h) => h());
    });

    this.createTab('-- Escribe tu consulta SQL aquí\nSELECT 1 AS ejemplo;');
  }

  onRun(handler: () => void): void {
    this.runHandlers.push(handler);
  }

  onTabChange(handler: (tab: QueryTab) => void): void {
    this.tabChangeHandlers.push(handler);
  }

  getActiveTab(): QueryTab | undefined {
    return this.tabs.find((t) => t.id === this.activeId);
  }

  getActiveTabId(): string {
    return this.activeId;
  }

  setTabResult(tabId: string, result: TabResultState): void {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (tab) {
      tab.result = result;
      this.renderTabBar();
    }
  }

  getTabResult(tabId: string): TabResultState {
    return this.tabs.find((t) => t.id === tabId)?.result ?? emptyResult();
  }

  clearAllResults(): void {
    for (const tab of this.tabs) {
      tab.result = emptyResult();
    }
  }

  createTab(sql?: string): string {
    this.syncActiveTab();

    const tab: QueryTab = {
      id: crypto.randomUUID(),
      title: nextTabTitle(),
      sql: sql ?? '-- Nueva consulta\n',
      result: emptyResult(),
    };
    this.tabs.push(tab);
    this.switchTab(tab.id);
    this.renderTabBar();
    this.editor.focus();
    return tab.id;
  }

  closeTab(id: string): void {
    if (this.tabs.length <= 1) return;

    const index = this.tabs.findIndex((t) => t.id === id);
    if (index === -1) return;

    const wasActive = this.activeId === id;
    this.tabs.splice(index, 1);

    if (wasActive) {
      const next = this.tabs[Math.min(index, this.tabs.length - 1)];
      this.activeId = next.id;
      this.editor.setValue(next.sql);
      this.notifyTabChange(next);
    }

    this.renderTabBar();
    this.editor.focus();
  }

  switchTab(id: string): void {
    if (this.activeId === id) return;

    this.syncActiveTab();

    const tab = this.tabs.find((t) => t.id === id);
    if (!tab) return;

    this.activeId = id;
    this.editor.setValue(tab.sql);
    this.renderTabBar();
    this.notifyTabChange(tab);
  }

  setActiveSql(sql: string): void {
    this.editor.setValue(sql);
    this.syncActiveTab();
    this.renderTabBar();
    this.editor.focus();
  }

  getActiveSql(): { selected: string; full: string } {
    const selected = this.editor.getSelectedText().trim();
    const full = this.editor.getValue().trim();
    return { selected, full };
  }

  focus(): void {
    this.editor.focus();
  }

  private notifyTabChange(tab: QueryTab): void {
    this.tabChangeHandlers.forEach((h) => h(tab));
  }

  private syncActiveTab(): void {
    const tab = this.tabs.find((t) => t.id === this.activeId);
    if (!tab) return;
    tab.sql = this.editor.getValue();
    tab.title = deriveTitle(tab.sql, tab.title);
  }

  private renderTabBar(): void {
    this.tabBarEl.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'query-tabs-list';

    for (const tab of this.tabs) {
      const el = document.createElement('div');
      const hasResult = tab.result.kind === 'data' || tab.result.kind === 'message';
      el.className = `query-tab${tab.id === this.activeId ? ' query-tab--active' : ''}${hasResult ? ' query-tab--has-result' : ''}`;
      el.title = tab.title;

      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'query-tab-label';
      label.textContent = tab.title;
      label.addEventListener('click', () => this.switchTab(tab.id));

      el.appendChild(label);

      if (this.tabs.length > 1) {
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'query-tab-close';
        close.textContent = '×';
        close.title = 'Cerrar';
        close.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeTab(tab.id);
        });
        el.appendChild(close);
      }

      list.appendChild(el);
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'query-tab-add';
    addBtn.textContent = '+';
    addBtn.title = 'Nueva consulta';
    addBtn.addEventListener('click', () => this.createTab());

    this.tabBarEl.appendChild(list);
    this.tabBarEl.appendChild(addBtn);
  }

  dispose(): void {
    this.editor.dispose();
  }
}
