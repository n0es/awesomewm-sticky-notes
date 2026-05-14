const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('menuApi', {
  selectAction: (action, data) => {
    ipcRenderer.send('context-menu-action', action, data);
  }
});
