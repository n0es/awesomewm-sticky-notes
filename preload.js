const { contextBridge } = require('electron');
const fs = require('fs');
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
  parseMarkdown: (text) => {
    return marked.lexer(text);
  },
  getNotePath: () => {
    const arg = process.argv.find(a => a.startsWith('--note-path='));
    return arg ? arg.split('=')[1] : null;
  }
});
