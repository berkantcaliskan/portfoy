const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback) => {
    const handler = (_event, isMax) => callback(isMax)
    ipcRenderer.on('window-maximize-changed', handler)
    return () => ipcRenderer.removeListener('window-maximize-changed', handler)
  },
  // Permanent Disk Store Bridge (zero data loss across restarts & no 5MB limit)
  readDiskStoreSync: () => ipcRenderer.sendSync('disk-store-read-sync'),
  writeDiskStoreKey: (key, value) => ipcRenderer.send('disk-store-write-key', key, value),
  removeDiskStoreKey: (key) => ipcRenderer.send('disk-store-remove-key', key),
  replaceDiskStoreAll: (obj) => ipcRenderer.send('disk-store-replace-all', obj),
  // Automatic GitHub & Cloud OTA Update Bridge
  checkForUpdates: () => ipcRenderer.invoke('ota-check-now'),
  getOtaStatus: () => ipcRenderer.invoke('ota-get-status'),
  onOtaUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('ota-status-changed', handler)
    return () => ipcRenderer.removeListener('ota-status-changed', handler)
  },
})
