const { app, BrowserWindow } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Default note if none provided
const defaultNote = path.join(app.getPath('home'), 'obsidian_vault', 'sticky_note.md');

// Improved arg parsing: find first non-option argument that isn't the app path
const noteToOpen = process.argv.slice(1).find(arg => {
  // Skip electron binary and app bundle paths
  if (arg.includes('node_modules') || arg.endsWith('electron') || arg.endsWith('sticky-notes')) return false;
  // Look for .md files or paths containing 'vault'
  return !arg.startsWith('--') && (arg.endsWith('.md') || arg.includes('vault'));
}) || defaultNote;

console.error(`[Main] Opening note: "${noteToOpen}"`);
console.error(`[Main] Argv: ${JSON.stringify(process.argv)}`);

// Set unique user data path for this note to allow multiple instances
const noteHash = crypto.createHash('md5').update(noteToOpen).digest('hex').substring(0, 8);
const userDataPath = path.join(app.getPath('appData'), `sticky-notes-${noteHash}`);
app.setPath('userData', userDataPath);

const stateFilePath = path.join(userDataPath, 'window-state.json');

function loadWindowState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      return JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load window state:', e);
  }
  return {
    width: 400,
    height: 400,
    x: 100 + (Math.floor(Math.random() * 5) * 50),
    y: 100 + (Math.floor(Math.random() * 5) * 50)
  };
}

function saveWindowState(state) {
  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    fs.writeFileSync(stateFilePath, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

function createWindow() {
  const state = loadWindowState();

  const mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      additionalArguments: [
        `--note-path=${noteToOpen}`,
        `--app-version=${app.getVersion()}`
      ]
    }
  });

  const saveState = () => {
    const bounds = mainWindow.getBounds();
    saveWindowState(bounds);
  };

  mainWindow.on('move', saveState);
  mainWindow.on('resize', saveState);

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
