const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Single User Data path for all instances
const userDataPath = path.join(app.getPath('appData'), 'sticky-notes-v2');
app.setPath('userData', userDataPath);

const stateFilePath = path.join(userDataPath, 'window-states.json');
const vaultPath = path.join(app.getPath('home'), 'obsidian_vault');

function getNotePathFromArgv(argv) {
  return argv.slice(1).find(arg => {
    if (arg.includes('node_modules') || arg.endsWith('electron') || arg.endsWith('sticky-notes')) return false;
    return !arg.startsWith('--') && (arg.endsWith('.md') || arg.includes('vault'));
  });
}

function loadAllWindowStates() {
  try {
    if (fs.existsSync(stateFilePath)) {
      return JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load window states:', e);
  }
  return {};
}

function saveWindowState(notePath, bounds, isOpen = true) {
  const states = loadAllWindowStates();
  states[notePath] = { ...bounds, isOpen };
  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    fs.writeFileSync(stateFilePath, JSON.stringify(states));
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

function createNewNoteFile() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `Note-${timestamp}.md`;
  const filePath = path.join(vaultPath, fileName);
  if (!fs.existsSync(vaultPath)) {
    fs.mkdirSync(vaultPath, { recursive: true });
  }
  fs.writeFileSync(filePath, '# New Note\n\n', 'utf8');
  return filePath;
}

function openNoteWindow(notePath) {
  // Check if window for this note is already open
  const existingWindow = BrowserWindow.getAllWindows().find(win => {
    return win.notePath === notePath;
  });

  if (existingWindow) {
    existingWindow.focus();
    return;
  }

  const states = loadAllWindowStates();
  const state = states[notePath] || {
    width: 400,
    height: 400,
    x: 100 + (Math.floor(Math.random() * 5) * 50),
    y: 100 + (Math.floor(Math.random() * 5) * 50),
    color: '#fdf6e3'
  };

  const win = new BrowserWindow({
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
        `--note-path=${notePath}`,
        `--app-version=${app.getVersion()}`,
        `--note-color=${state.color || '#fdf6e3'}`
      ]
    }
  });

  win.notePath = notePath;

  const saveState = () => {
    const bounds = win.getBounds();
    const currentStates = loadAllWindowStates();
    const currentState = currentStates[notePath] || {};
    saveWindowState(notePath, { ...currentState, ...bounds }, true);
  };

  win.on('move', saveState);
  win.on('resize', saveState);
  win.on('close', () => {
    const bounds = win.getBounds();
    const currentStates = loadAllWindowStates();
    const currentState = currentStates[notePath] || {};
    saveWindowState(notePath, { ...currentState, ...bounds }, false);
  });

  win.loadFile('index.html');
}

ipcMain.on('open-note', (event, filePath) => {
  openNoteWindow(filePath);
});

ipcMain.on('create-new-note', () => {
  const newNotePath = createNewNoteFile();
  openNoteWindow(newNotePath);
});

ipcMain.on('close-note', (event, filePath) => {
  const win = BrowserWindow.getAllWindows().find(w => w.notePath === filePath);
  if (win) win.close();
});

ipcMain.on('set-note-color', (event, { filePath, color }) => {
  const states = loadAllWindowStates();
  if (states[filePath]) {
    states[filePath].color = color;
    saveWindowState(filePath, states[filePath], states[filePath].isOpen);
  }
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const notePath = getNotePathFromArgv(commandLine);
    if (notePath) {
      openNoteWindow(notePath);
    } else {
      // If no path provided, create a new blank note
      const newNotePath = createNewNoteFile();
      openNoteWindow(newNotePath);
    }
  });

  app.whenReady().then(() => {
    const notePath = getNotePathFromArgv(process.argv);
    if (notePath) {
      openNoteWindow(notePath);
    } else {
      // Session restoration: open all notes that were open last time
      const states = loadAllWindowStates();
      const openNotes = Object.keys(states).filter(path => states[path].isOpen);
      
      if (openNotes.length > 0) {
        openNotes.forEach(note => openNoteWindow(note));
      } else {
        // Fallback to defaults
        openNoteWindow(path.join(vaultPath, 'sticky_note.md'));
        openNoteWindow(path.join(vaultPath, 'todo.md'));
      }
    }
  });
}

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
