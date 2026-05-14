const { app, BrowserWindow } = require('electron');
const path = require('path');
const crypto = require('crypto');

// Default note if none provided
const defaultNote = path.join(app.getPath('home'), 'obsidian_vault', 'sticky_note.md');

// Improved arg parsing: find first non-option argument that isn't the app path
const noteToOpen = process.argv.slice(1).find(arg => !arg.startsWith('--') && (arg.endsWith('.md') || arg.includes('vault'))) || defaultNote;

console.log('Opening note:', noteToOpen);

// Set unique user data path for this note to allow multiple instances
const noteHash = crypto.createHash('md5').update(noteToOpen).digest('hex').substring(0, 8);
app.setPath('userData', path.join(app.getPath('appData'), `sticky-notes-${noteHash}`));

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 400,
    height: 400,
    // Offset each instance slightly so they don't overlap perfectly
    x: 100 + (Math.floor(Math.random() * 5) * 50),
    y: 100 + (Math.floor(Math.random() * 5) * 50),
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
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
