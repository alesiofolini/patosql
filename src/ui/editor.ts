import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { setupSqlCompletion } from './sql-completion';

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

setupSqlCompletion();

export interface SqlEditor {
  getValue: () => string;
  setValue: (sql: string) => void;
  getSelectedText: () => string;
  focus: () => void;
  dispose: () => void;
  onRun: (handler: () => void) => void;
}

export function createSqlEditor(container: HTMLElement): SqlEditor {
  const editor = monaco.editor.create(container, {
    value: '-- Escribe tu consulta SQL aquí\nSELECT 1 AS ejemplo;',
    language: 'sql',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    padding: { top: 12, bottom: 12 },
    tabSize: 2,
    suggestOnTriggerCharacters: true,
    quickSuggestions: { other: true, strings: false, comments: false },
    wordBasedSuggestions: 'off',
  });

  const runHandlers: Array<() => void> = [];

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    runHandlers.forEach((h) => h());
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
    editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
  });

  return {
    getValue: () => editor.getValue(),
    setValue: (sql) => editor.setValue(sql),
    getSelectedText: () => {
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) return '';
      return editor.getModel()?.getValueInRange(selection) ?? '';
    },
    focus: () => editor.focus(),
    dispose: () => editor.dispose(),
    onRun: (handler) => {
      runHandlers.push(handler);
    },
  };
}
