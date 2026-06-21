/* ==========================================================================
   The Quiet Page — Preload (Context Bridge)
   ==========================================================================
   Exposes a small, safe API to the renderer:
     window.QuietPage = { storage, dialog, app, menu }
   ========================================================================== */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('QuietPage', {
  /* ----- Storage ----- */
  storage: {
    loadEntries:   ()  => ipcRenderer.invoke('entries:load'),
    saveEntries:   (e) => ipcRenderer.invoke('entries:save', e),
    loadSettings:  ()  => ipcRenderer.invoke('settings:load'),
    saveSettings:  (s) => ipcRenderer.invoke('settings:save', s),
    loadDraft:     ()  => ipcRenderer.invoke('draft:load'),
    saveDraft:     (t) => ipcRenderer.invoke('draft:save', t),
  },

  /* ----- Dialogs ----- */
  dialog: {
    saveExport: (opts) => ipcRenderer.invoke('dialog:save-export', opts),
    openImport: ()      => ipcRenderer.invoke('dialog:open-import'),
    confirm:    (opts)  => ipcRenderer.invoke('dialog:confirm', opts),
  },

  /* ----- App info ----- */
  app: {
    getVersion:     () => ipcRenderer.invoke('app:get-version'),
    openDataFolder: () => ipcRenderer.invoke('app:open-data-folder'),
  },

  /* ----- Menu events (main → renderer) ----- */
  menu: {
    on: (channel, cb) => {
      const valid = [
        'menu:new-entry', 'menu:publish', 'menu:export-json', 'menu:export-txt',
        'menu:import', 'menu:tab', 'menu:cycle-theme', 'menu:focus-composer',
        'menu:search', 'menu:about',
      ];
      if (valid.indexOf(channel) === -1) return;
      const listener = (_evt, ...args) => cb(...args);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },
});
