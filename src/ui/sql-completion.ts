import * as monaco from 'monaco-editor';
import {
  findColumnsForTableName,
  findTable,
  getColumns,
  getSchemaCache,
} from '../db/schema-cache';

const DUCKDB_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS',
  'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'GROUP', 'BY',
  'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT', 'CREATE', 'TABLE',
  'VIEW', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'DROP', 'ALTER', 'WITH',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'DESCRIBE', 'SHOW', 'PRAGMA', 'EXPLAIN', 'ATTACH', 'DETACH', 'COPY', 'TRUE', 'FALSE',
];

let registered = false;

function quoteIdent(name: string): string {
  return /[^a-zA-Z0-9_]/.test(name) ? `"${name.replace(/"/g, '""')}"` : name;
}

function getWordRange(model: monaco.editor.ITextModel, position: monaco.Position) {
  const word = model.getWordUntilPosition(position);
  return new monaco.Range(
    position.lineNumber,
    word.startColumn,
    position.lineNumber,
    word.endColumn
  );
}

function getPrefixContext(model: monaco.editor.ITextModel, position: monaco.Position) {
  const line = model.getLineContent(position.lineNumber);
  const before = line.slice(0, position.column - 1);

  const qualified = before.match(/(?:"([^"]+)"|([a-zA-Z_][\w]*))\.(?:"([^"]*)"?)?$/);
  if (qualified) {
    const tableName = qualified[1] || qualified[2];
    const partialCol = qualified[3] ?? '';
    return { kind: 'column' as const, tableName, partial: partialCol };
  }

  const schema = before.match(/(?:"([^"]+)"|([a-zA-Z_][\w]*))\.(?:")?$/);
  if (schema && !before.endsWith('.')) {
    const schemaName = schema[1] || schema[2];
    return { kind: 'table-in-schema' as const, schemaName, partial: '' };
  }

  const word = model.getWordUntilPosition(position);
  return { kind: 'general' as const, partial: word.word };
}

function tableSuggestions(
  range: monaco.Range,
  filter: string,
  schemaFilter?: string
): monaco.languages.CompletionItem[] {
  const lower = filter.toLowerCase();
  const { tables } = getSchemaCache();

  return tables
    .filter((t) => {
      if (schemaFilter && t.schema.toLowerCase() !== schemaFilter.toLowerCase()) return false;
      if (!lower) return true;
      return (
        t.name.toLowerCase().includes(lower) ||
        t.schema.toLowerCase().includes(lower) ||
        `${t.schema}.${t.name}`.toLowerCase().includes(lower)
      );
    })
    .map((t) => ({
      label: t.name,
      kind: monaco.languages.CompletionItemKind.Class,
      insertText: quoteIdent(t.name),
      detail: `${t.type} · ${t.schema}`,
      filterText: `${t.schema} ${t.name}`,
      sortText: `0_${t.name}`,
      range,
    }));
}

function columnSuggestions(
  range: monaco.Range,
  tableName: string,
  filter: string
): monaco.languages.CompletionItem[] {
  const lower = filter.toLowerCase();
  const table = findTable(null, tableName);
  const cols = table ? getColumns(table.schema, table.name) : findColumnsForTableName(tableName);

  return cols
    .filter((c) => !lower || c.name.toLowerCase().includes(lower))
    .map((c) => ({
      label: c.name,
      kind: monaco.languages.CompletionItemKind.Field,
      insertText: quoteIdent(c.name),
      detail: `${c.type} · ${tableName}`,
      sortText: `0_${c.name}`,
      range,
    }));
}

function allColumnSuggestions(range: monaco.Range, filter: string): monaco.languages.CompletionItem[] {
  const lower = filter.toLowerCase();
  const seen = new Set<string>();
  const items: monaco.languages.CompletionItem[] = [];

  for (const table of getSchemaCache().tables) {
    for (const col of getColumns(table.schema, table.name)) {
      if (lower && !col.name.toLowerCase().includes(lower)) continue;
      const key = `${table.name}.${col.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        label: col.name,
        kind: monaco.languages.CompletionItemKind.Field,
        insertText: quoteIdent(col.name),
        detail: `${col.type} · ${table.name}`,
        filterText: `${col.name} ${table.name}`,
        sortText: `1_${col.name}`,
        range,
      });
    }
  }

  return items;
}

function keywordSuggestions(
  range: monaco.Range,
  filter: string
): monaco.languages.CompletionItem[] {
  const lower = filter.toLowerCase();
  return DUCKDB_KEYWORDS.filter((kw) => kw.toLowerCase().startsWith(lower)).map((kw) => ({
    label: kw,
    kind: monaco.languages.CompletionItemKind.Keyword,
    insertText: kw,
    sortText: `2_${kw}`,
    range,
  }));
}

export function setupSqlCompletion(): void {
  if (registered) return;
  registered = true;

  monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' ', '"'],
    provideCompletionItems(model, position) {
      const range = getWordRange(model, position);
      const ctx = getPrefixContext(model, position);

      if (ctx.kind === 'column') {
        return {
          suggestions: columnSuggestions(range, ctx.tableName, ctx.partial),
        };
      }

      if (ctx.kind === 'table-in-schema') {
        return {
          suggestions: tableSuggestions(range, ctx.partial, ctx.schemaName),
        };
      }

      return {
        suggestions: [
          ...tableSuggestions(range, ctx.partial),
          ...allColumnSuggestions(range, ctx.partial),
          ...keywordSuggestions(range, ctx.partial),
        ],
      };
    },
  });
}
