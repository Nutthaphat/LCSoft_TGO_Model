const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
  emission: {
    load: () => ipcRenderer.invoke('db:emission:load'),
    save: (snapshot) => ipcRenderer.invoke('db:emission:save', snapshot),
  },
  projects: {
    list: () => ipcRenderer.invoke('db:projects:list'),
    get: (id) => ipcRenderer.invoke('db:projects:get', id),
    save: (workspace) => ipcRenderer.invoke('db:projects:save', workspace),
    delete: (id) => ipcRenderer.invoke('db:projects:delete', id),
    getActiveId: () => ipcRenderer.invoke('db:projects:getActiveId'),
    setActiveId: (id) => ipcRenderer.invoke('db:projects:setActiveId', id),
  },
  backup: () => ipcRenderer.invoke('db:backup'),
});
