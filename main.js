const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Single User Data path for all instances
const userDataPath = path.join(app.getPath('appData'), 'sticky-notes-v2');
app.setPath('userData', userDataPath);

const stateFilePath = path.join(userDataPath, 'window-states.json');
let sessionRestoring = false;
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
    return existingWindow;
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
    alwaysOnTop: true,
    type: 'utility',
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
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    const currentStates = loadAllWindowStates();
    const currentState = currentStates[notePath] || {};
    saveWindowState(notePath, { ...currentState, ...bounds }, true);
  };

  win.on('move', saveState);
  win.on('resize', saveState);
  win.on('focus', () => {
    if (sessionRestoring) return;
    const currentStates = loadAllWindowStates();
    const currentState = currentStates[notePath] || {};
    saveWindowState(notePath, { ...currentState, lastFocused: Date.now() }, true);
  });
  win.on('close', () => {
    const bounds = win.getBounds();
    const currentStates = loadAllWindowStates();
    const currentState = currentStates[notePath] || {};
    saveWindowState(notePath, { ...currentState, ...bounds }, false);
  });

  win.loadFile('index.html');
  return win;
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

let contextMenuWin = null;
let contextMenuParent = null;

function closeContextMenu() {
  if (contextMenuWin && !contextMenuWin.isDestroyed()) {
    contextMenuWin.destroy();
  }
  contextMenuWin = null;
}

ipcMain.on('show-context-menu', (event, screenX, screenY) => {
  closeContextMenu();

  contextMenuParent = BrowserWindow.fromWebContents(event.sender);
  // Prefer coordinates from renderer (exact click position); fall back to cursor query
  const fallback = screen.getCursorScreenPoint();
  const x = (screenX != null) ? screenX : fallback.x;
  const y = (screenY != null) ? screenY : fallback.y;

  contextMenuWin = new BrowserWindow({
    width: 180,
    height: 310,
    x,
    y,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    type: 'utility',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-menu.js')
    }
  });

  contextMenuWin.setAlwaysOnTop(true, 'pop-up-menu');
  contextMenuWin.loadFile('context-menu.html');

  // AwesomeWM centers new windows on map. Override by watching the move event
  // and immediately snapping back to target position whenever WM moves us.
  // Guard against setPosition itself triggering move to prevent loops.
  let correcting = false;
  contextMenuWin.on('move', () => {
    if (correcting || !contextMenuWin || contextMenuWin.isDestroyed()) return;
    const [cx, cy] = contextMenuWin.getPosition();
    if (cx !== x || cy !== y) {
      correcting = true;
      contextMenuWin.setPosition(x, y);
      setTimeout(() => { correcting = false; }, 32);
    }
  });

  contextMenuWin.on('blur', () => closeContextMenu());
  contextMenuWin.on('closed', () => { contextMenuWin = null; });
});

ipcMain.on('dismiss-context-menu', () => {
  closeContextMenu();
});

ipcMain.on('context-menu-action', (event, action, data) => {
  if (contextMenuParent && !contextMenuParent.isDestroyed()) {
    contextMenuParent.webContents.send('context-menu-action', action, data);
  }
  closeContextMenu();
  contextMenuParent = null;
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
      const openNotes = Object.keys(states)
        .filter(p => states[p].isOpen)
        .sort((a, b) => (states[a].lastFocused || 0) - (states[b].lastFocused || 0));

      if (openNotes.length > 0) {
        sessionRestoring = true;
        openNotes.forEach(note => openNoteWindow(note));
        // Raise the topmost note (last in sorted order) after WM settles
        const topNotePath = openNotes[openNotes.length - 1];
        setTimeout(() => {
          const topWin = BrowserWindow.getAllWindows().find(w => w.notePath === topNotePath);
          if (topWin && !topWin.isDestroyed()) {
            topWin.focus();
          }
          sessionRestoring = false;
        }, 300);
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
