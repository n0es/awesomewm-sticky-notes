const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { marked } = require('marked');

contextBridge.exposeInMainWorld('api', {
  readNote: (filePath) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      return `File not found: ${filePath}`;
    }
  },
  saveNote: (filePath, content) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error("Error writing file", e);
      return false;
    }
  },
  watchNote: (filePath, callback) => {
    const watcher = chokidar.watch(filePath, { persistent: true });
    watcher.on('change', () => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        callback(content);
      } catch (e) {
        console.error("Error reading file", e);
      }
    });
    return () => watcher.close();
  },
  listVault: (vaultPath) => {
    try {
      return fs.readdirSync(vaultPath)
        .filter(f => f.endsWith('.md'))
        .map(f => ({ name: f, path: path.join(vaultPath, f) }));
    } catch (e) {
      return [];
    }
  },
  openNote: (filePath) => {
    ipcRenderer.send('open-note', filePath);
  },
  getVaultPath: () => {
    // This could be passed via args or hardcoded
    return path.join(process.env.HOME, 'obsidian_vault');
  },
  parseMarkdown: (text) => {
    return marked.lexer(text);
  },
  archiveNote: (filePath) => {
    try {
      const archiveDir = path.join(path.dirname(filePath), 'archive');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);
      const dest = path.join(archiveDir, path.basename(filePath));
      fs.renameSync(filePath, dest);
      return true;
    } catch (e) {
      return false;
    }
  },
  deleteNote: (filePath) => {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (e) {
      return false;
    }
  },
  setNoteColor: (filePath, color) => {
    ipcRenderer.send('set-note-color', { filePath, color });
  },
  closeNote: (filePath) => {
    ipcRenderer.send('close-note', filePath);
  },
  createNewNote: () => {
    ipcRenderer.send('create-new-note');
  },
  getNotePath: () => {
    const arg = process.argv.find(a => a.startsWith('--note-path='));
    return arg ? arg.split('=')[1] : null;
  },
  getVersion: () => {
    const arg = process.argv.find(a => a.startsWith('--app-version='));
    return arg ? arg.split('=')[1] : '1.6.6';
  },
  getNoteColor: () => {
    const arg = process.argv.find(a => a.startsWith('--note-color='));
    return arg ? arg.split('=')[1] : '#fdf6e3';
  }
});
