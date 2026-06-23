const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { startStaticServer } = require('./static-server.cjs');

const isDev = !app.isPackaged;
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

let staticServer = null;

function enableCrossOriginIsolation() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    headers['Cross-Origin-Opener-Policy'] = ['same-origin'];
    headers['Cross-Origin-Embedder-Policy'] = ['require-corp'];
    callback({ responseHeaders: headers });
  });
}

async function createWindow(loadUrl) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'PatoSQL',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await win.loadURL(loadUrl);

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  enableCrossOriginIsolation();

  let loadUrl = DEV_URL;
  if (!isDev) {
    const distPath = path.join(__dirname, '../dist');
    const started = await startStaticServer(distPath);
    staticServer = started.server;
    loadUrl = started.url;
  }

  await createWindow(loadUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow(loadUrl);
    }
  });
});

app.on('before-quit', () => {
  if (staticServer) staticServer.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
