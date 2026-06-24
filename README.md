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

GitHub Pages **no puede** servir el código fuente (`index.html` con `/src/main.ts`). Hay que publicar la carpeta `dist/` compilada.

### 1. Publicar el build

```bash
npm run deploy:pages
```

Eso compila con `base: /patosql/` y sube `dist/` a la rama `gh-pages`.

### 2. Configurar Pages en GitHub

En el repo: **Settings → Pages**

- **Source:** Deploy from a branch
- **Branch:** `gh-pages` / `(root)`
- **No** uses la rama `main` como fuente del sitio

### 3. Abrí el sitio

`https://alesiofolini.github.io/patosql/`

> Si ves errores 404 en `main.ts` o `icon.png`, Pages está sirviendo `main` en lugar del build. Cambiá la fuente a `gh-pages`.

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
