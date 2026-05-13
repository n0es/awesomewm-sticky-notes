const { app, BrowserWindow } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const crypto = require('crypto');

// Default note if none provided
const defaultNote = path.join(app.getPath('home'), 'obsidian_vault', 'sticky_note.md');
const noteToOpen = process.argv.find(arg => arg.endsWith('.md')) || defaultNote;

// Set unique user data path for this note to allow multiple instances
const noteHash = crypto.createHash('md5').update(noteToOpen).digest('hex').substring(0, 8);
app.setPath('userData', path.join(app.getPath('appData'), `sticky-notes-${noteHash}`));

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 400,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      additionalArguments: [`--note-path=${noteToOpen}`]
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.error('Update check failed:', err);
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
