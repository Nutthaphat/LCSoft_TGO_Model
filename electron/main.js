const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createDatabase } = require('./db/database');

const isDev = !app.isPackaged;
let mainWindow = null;
let database = null;

async function createWindow() {
  database = await createDatabase(app.getPath('userData'));

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1366,
    minHeight: 768,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:4200');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexHtml = path.join(__dirname, '..', 'dist', 'LCSoft_TGO_Model', 'browser', 'index.html');
    await mainWindow.loadFile(indexHtml);
  }
}

function registerIpc() {
  ipcMain.handle('app:getInfo', async () => ({
    isElectron: true,
    dbPath: database.dbPath,
    userDataPath: app.getPath('userData'),
  }));

  ipcMain.handle('db:emission:load', async () => database.loadEmissionDatabase());
  ipcMain.handle('db:emission:save', async (_event, snapshot) => {
    database.saveEmissionDatabase(snapshot);
    return { ok: true };
  });

  ipcMain.handle('db:projects:list', async () => database.listProjects());
  ipcMain.handle('db:projects:get', async (_event, id) => database.getProjectWorkspace(id));
  ipcMain.handle('db:projects:save', async (_event, workspace) => {
    database.saveProjectWorkspace(workspace);
    return { ok: true };
  });
  ipcMain.handle('db:projects:delete', async (_event, id) => {
    database.deleteProject(id);
    return { ok: true };
  });
  ipcMain.handle('db:projects:getActiveId', async () => database.getActiveProjectId());
  ipcMain.handle('db:projects:setActiveId', async (_event, id) => {
    database.setActiveProjectId(id);
    return { ok: true };
  });
  ipcMain.handle('db:backup', async () => database.backup());
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (database) {
    database.persist();
  }
});
