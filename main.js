const { app, BrowserWindow } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 400,
    x: 100,
    y: 100,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    // type: 'desktop', // This sometimes tells AwesomeWM to treat it as a desktop widget
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    }
  });

  // Set window class so AwesomeWM can be configured to float it and remove borders
  // You might want to configure this in rc.lua, e.g.:
  // { rule = { class = "sticky-notes" }, properties = { floating = true, sticky = true, ontop = false } }

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();
  
  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
