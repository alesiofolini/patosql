# PatoSQL

GUI SQL con DuckDB en el navegador — conectá bases, importá archivos, explorá tablas y ejecutá consultas con autocompletado.

Herramienta comunitaria, no afiliada a DuckDB.

## Características

- **Conectar** a base en memoria, abrir `.duckdb` existente o crear una nueva
- **Explorador de objetos** con esquemas, tablas y columnas
- **Editor SQL** (Monaco) con `Ctrl+Enter` para ejecutar y `Ctrl+Space` para autocompletar
- **Importar archivos** CSV, TSV, **Excel (.xlsx / .xls)**, Parquet y JSON a tablas
- **Exportar resultados** a CSV o Excel
- **Guardar** la base como archivo `.duckdb`
- **Pestañas** de consulta con resultados independientes

## Uso web (local)

```bash
npm install
npm run dev
```

Abrí http://localhost:5173

## GitHub Pages

```bash
npm run build:pages
npx gh-pages -d dist
```

Luego en el repo: **Settings → Pages → Branch `gh-pages`**.

URL: `https://alesiofolini.github.io/patosql/`

## App de escritorio (Mac)

```bash
npm run electron:build
```

Instalador en `release/PatoSQL-1.0.0-arm64.dmg`

> macOS puede bloquear la app por no estar firmada: **Ajustes → Privacidad y seguridad → Abrir de todas formas**.

## Stack

- [DuckDB-WASM](https://duckdb.org/docs/api/wasm)
- Vite + TypeScript + Monaco Editor
- Electron (solo build de escritorio)

## Privacidad

Todo corre en tu máquina o navegador. Tus datos y SQL no se envían a ningún servidor.

## Licencia

[MIT](LICENSE) — Copyright (c) 2026 Alesio Folini

## Aviso

PatoSQL es un proyecto independiente y no está afiliado, respaldado ni patrocinado por DuckDB.
DuckDB es una marca de sus respectivos titulares. Las dependencias de terceros (DuckDB-WASM, Monaco, SheetJS, etc.) mantienen sus propias licencias.
