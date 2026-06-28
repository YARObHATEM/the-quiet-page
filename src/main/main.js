/* ==========================================================================
   The Quiet Page — Electron Main Process
   ==========================================================================
   - Creates the BrowserWindow
   - Provides native application menu
   - Bridges renderer ↔ filesystem (entries, settings, drafts)
   - Handles export/import via native dialogs
   ========================================================================== */

const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { extractTitleAndBody } = require('../renderer/js/utils');

const isDev = process.argv.includes('--dev');
const isMac = process.platform === 'darwin';

if (process.env.QUIET_PAGE_USER_DATA_DIR) {
  app.setPath('userData', path.resolve(process.env.QUIET_PAGE_USER_DATA_DIR));
}

let mainWindow = null;

/* ---------- Persistent storage paths ---------- */

function userDataPath(...segments) {
  const base = app.getPath('userData');
  return path.join(base, ...segments);
}

const FILES = {
  entries: () => userDataPath('entries.json'),
  settings: () => userDataPath('settings.json'),
  draft: () => userDataPath('draft.json'),
};

const MAX_ENTRIES = 100000;
const MAX_ENTRY_TEXT_LENGTH = 2000000;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_EXPORT_BYTES = 50 * 1024 * 1024;
const writeQueues = new Map();

/* ---------- Safe file helpers (never throw to renderer) ---------- */

async function readJSON(file, fallback) {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('readJSON failed:', file, err.message);
    return fallback;
  }
}

function queueFileWrite(file, operation) {
  const previous = writeQueues.get(file) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  writeQueues.set(file, current);
  current.finally(() => {
    if (writeQueues.get(file) === current) writeQueues.delete(file);
  });
  return current;
}

async function writeJSONNow(file, value) {
  try {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
    await fsp.rename(tmp, file);
    return true;
  } catch (err) {
    console.error('writeJSON failed:', file, err);
    return false;
  }
}

function writeJSON(file, value) {
  return queueFileWrite(file, () => writeJSONNow(file, value));
}

async function readText(file, fallback) {
  try {
    return await fsp.readFile(file, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('readText failed:', file, err.message);
    return fallback;
  }
}

async function writeTextNow(file, value) {
  try {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, value, 'utf8');
    return true;
  } catch (err) {
    console.error('writeText failed:', file, err);
    return false;
  }
}

function writeText(file, value) {
  return queueFileWrite(file, () => writeTextNow(file, value));
}

/* ---------- Default settings (mirror renderer) ---------- */

const DEFAULT_SETTINGS = {
  theme: 'sage',
  font: 'cormorant',
  englishFont: 'default',
  arabicFont: 'default',
  size: 'medium',
  leading: 'normal',
  width: 'medium',
  soundEnabled: true,
  soundType: 'typewriter',
  volume: 40,
  bellOnPublish: true,
  uiScale: 100,
  ambientMood: null,
  ambientVolume: 40,
  typewriterScroll: true,
  enterToPublish: false, // Default: Ctrl+Enter publishes, Enter = new line
  autoSaveDraft: true,
  showWordCount: true,
  confirmDelete: true,
  // Desktop-only:
  windowBounds: null,
  activeTab: 'write',
  focusMode: false,
};

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBounds(value) {
  if (!isPlainObject(value)) return null;

  const width = Number(value.width);
  const height = Number(value.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const bounds = {
    width: Math.min(10000, Math.max(900, Math.round(width))),
    height: Math.min(10000, Math.max(600, Math.round(height))),
  };

  if (Number.isFinite(Number(value.x))) bounds.x = Math.round(Number(value.x));
  if (Number.isFinite(Number(value.y))) bounds.y = Math.round(Number(value.y));
  return bounds;
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function legacyEnglishFont(font) {
  if (font === 'newsreader') return 'newsreader';
  if (font === 'spectral') return 'spectral';
  return 'default';
}

function normalizeSettings(value) {
  const source = isPlainObject(value) ? value : {};
  const legacyFont = pickEnum(source.font, ['cormorant', 'newsreader', 'spectral', 'system'], DEFAULT_SETTINGS.font);
  return {
    theme: pickEnum(source.theme, ['sage', 'old-paper', 'typewriter', 'candlelight', 'moonlight', 'dusk', 'slate', 'midnight', 'forest', 'ember', 'rose', 'obsidian', 'steel', 'aurora', 'cave', 'noir'], DEFAULT_SETTINGS.theme),
    font: legacyFont,
    englishFont: pickEnum(
      source.englishFont,
      ['default', 'newsreader', 'spectral', 'lora', 'merriweather', 'jetbrains-mono', 'nunito', 'playfair-display'],
      legacyEnglishFont(legacyFont)
    ),
    arabicFont: pickEnum(
      source.arabicFont,
      ['default', 'tajawal', 'lateef', 'cairo', 'scheherazade-new'],
      DEFAULT_SETTINGS.arabicFont
    ),
    size: pickEnum(source.size, ['small', 'medium', 'large', 'xlarge'], DEFAULT_SETTINGS.size),
    leading: pickEnum(source.leading, ['compact', 'normal', 'relaxed'], DEFAULT_SETTINGS.leading),
    width: pickEnum(source.width, ['narrow', 'medium', 'wide'], DEFAULT_SETTINGS.width),
    soundEnabled: typeof source.soundEnabled === 'boolean' ? source.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    soundType: pickEnum(source.soundType, ['typewriter', 'mechanical', 'soft'], DEFAULT_SETTINGS.soundType),
    volume: Number.isFinite(Number(source.volume))
      ? Math.min(100, Math.max(0, Math.round(Number(source.volume))))
      : DEFAULT_SETTINGS.volume,
    bellOnPublish: typeof source.bellOnPublish === 'boolean' ? source.bellOnPublish : DEFAULT_SETTINGS.bellOnPublish,
    uiScale: pickEnum(Number(source.uiScale), [85, 90, 100, 110, 115], DEFAULT_SETTINGS.uiScale),
    ambientMood: pickEnum(source.ambientMood, ['rain', 'forest', 'cafe', 'lofi', 'fireplace', 'ocean', 'thunder', 'birds', 'river', 'wind', 'train', 'night', 'white-noise'], DEFAULT_SETTINGS.ambientMood),
    ambientVolume: Number.isFinite(Number(source.ambientVolume))
      ? Math.min(100, Math.max(0, Math.round(Number(source.ambientVolume))))
      : DEFAULT_SETTINGS.ambientVolume,
    typewriterScroll: typeof source.typewriterScroll === 'boolean' ? source.typewriterScroll : DEFAULT_SETTINGS.typewriterScroll,
    enterToPublish: typeof source.enterToPublish === 'boolean' ? source.enterToPublish : DEFAULT_SETTINGS.enterToPublish,
    autoSaveDraft: typeof source.autoSaveDraft === 'boolean' ? source.autoSaveDraft : DEFAULT_SETTINGS.autoSaveDraft,
    showWordCount: typeof source.showWordCount === 'boolean' ? source.showWordCount : DEFAULT_SETTINGS.showWordCount,
    confirmDelete: typeof source.confirmDelete === 'boolean' ? source.confirmDelete : DEFAULT_SETTINGS.confirmDelete,
    windowBounds: normalizeBounds(source.windowBounds),
    activeTab: pickEnum(source.activeTab, ['write', 'library', 'focus', 'insights', 'settings'], DEFAULT_SETTINGS.activeTab),
    focusMode: typeof source.focusMode === 'boolean' ? source.focusMode : DEFAULT_SETTINGS.focusMode,
  };
}

function createEntryId() {
  return `e_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function countWords(text) {
  return text && text.trim() ? text.trim().split(/\s+/).length : 0;
}

function sanitizeTag(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const tags = [];
  for (const raw of value) {
    const tag = sanitizeTag(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 12) break;
  }
  return tags;
}

function normalizeFolder(value) {
  const folder = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 48);
  return folder || 'Uncategorized';
}

function normalizeEntries(value) {
  if (!Array.isArray(value)) return [];

  const usedIds = new Set();
  const entries = [];

  for (const candidate of value.slice(0, MAX_ENTRIES)) {
    if (!isPlainObject(candidate)) continue;

    const sourceText = typeof candidate.text === 'string'
      ? candidate.text
      : (typeof candidate.content === 'string' ? candidate.content : '');
    const text = sourceText.slice(0, MAX_ENTRY_TEXT_LENGTH);
    if (!text.trim()) continue;
    const { title, body } = extractTitleAndBody(text);

    const createdTime = Date.parse(candidate.createdAt);
    const updatedTime = Date.parse(candidate.updatedAt);
    let id = typeof candidate.id === 'string' && /^e_[A-Za-z0-9_-]{1,120}$/.test(candidate.id)
      ? candidate.id
      : createEntryId();

    while (usedIds.has(id)) id = createEntryId();
    usedIds.add(id);

    const entry = {
      id,
      text,
      title,
      body,
      createdAt: Number.isFinite(createdTime)
        ? new Date(createdTime).toISOString()
        : new Date().toISOString(),
      pinned: candidate.pinned === true,
      wordCount: countWords(text),
      tags: normalizeTags(candidate.tags),
      folder: normalizeFolder(candidate.folder),
    };

    if (typeof candidate.html === 'string' && candidate.html.trim()) {
      entry.html = candidate.html.slice(0, MAX_ENTRY_TEXT_LENGTH * 2);
    }

    if (Number.isFinite(updatedTime)) {
      entry.updatedAt = new Date(updatedTime).toISOString();
    }

    entries.push(entry);
  }

  return entries;
}

function patchSettings(patch) {
  const file = FILES.settings();
  return queueFileWrite(file, async () => {
    const current = await readJSON(file, {});
    return writeJSONNow(file, normalizeSettings(Object.assign({}, current, patch)));
  });
}

/* ==========================================================================
   Window creation
   ========================================================================== */

function createWindow() {
  const settings = readSettingsSync();

  const bounds = settings.windowBounds || {
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
  };

  mainWindow = new BrowserWindow({
    width: bounds.width || 1280,
    height: bounds.height || 820,
    minWidth: 900,
    minHeight: 600,
    x: bounds.x,
    y: bounds.y,
    backgroundColor: getThemeBackground(settings.theme),
    title: 'The Quiet Page',
    show: false,
    autoHideMenuBar: true, // User can still tap Alt to reveal, but it's hidden by default
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, '..', '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  // Persist window bounds on resize/move (debounced)
  let boundsTimer = null;
  const persistBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized() || mainWindow.isMaximized()) return;
      const newBounds = mainWindow.getBounds();
      patchSettings({ windowBounds: newBounds }).catch(() => {});
    }, 600);
  };
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);

  // Show when ready (no white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    const key = String(input.key || '').toLowerCase();

    if (key === 'f11') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      return;
    }

    if (!ctrl) return;

    if (key === 'n') {
      event.preventDefault();
      mainWindow.webContents.send('menu:new-entry');
    } else if (key === 's') {
      event.preventDefault();
      mainWindow.webContents.send('menu:save-current');
    } else if (key === 'f' && input.shift) {
      event.preventDefault();
      mainWindow.webContents.send('menu:toggle-focus');
    } else if (key === 'f') {
      event.preventDefault();
      mainWindow.webContents.send('menu:search');
    } else if (key === 'l') {
      event.preventDefault();
      mainWindow.webContents.send('menu:tab', 'library');
    } else if (key === ',') {
      event.preventDefault();
      mainWindow.webContents.send('menu:tab', 'settings');
    } else if (key === 'e') {
      event.preventDefault();
      mainWindow.webContents.send('menu:export-json');
    } else if (key === 't') {
      event.preventDefault();
      mainWindow.webContents.send('menu:cycle-theme');
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getThemeBackground(theme) {
  const map = {
    sage: '#172019', 'old-paper': '#f5e6c8', typewriter: '#fafaf8',
    candlelight: '#1a1208', moonlight: '#0d1117', dusk: '#1e1a2e',
    slate: '#1E2329', midnight: '#141218', forest: '#182018', ember: '#1A0F08',
    rose: '#D4C2C0', obsidian: '#000000', steel: '#3A444E',
    aurora: '#0A0E1F', cave: '#1C1410', noir: '#1A1A18',
  };
  return map[theme] || map.sage;
}

function readSettingsSync() {
  // Synchronous read so window opens with correct colors
  try {
    const raw = fs.readFileSync(FILES.settings(), 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed);
  } catch (err) {
    return normalizeSettings({});
  }
}

/* ==========================================================================
   Application menu
   ========================================================================== */

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Entry',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow && mainWindow.webContents.send('menu:new-entry'),
        },
        {
          label: 'Publish Current Page',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow && mainWindow.webContents.send('menu:publish'),
        },
        { type: 'separator' },
        {
          label: 'Export as JSON…',
          click: () => mainWindow && mainWindow.webContents.send('menu:export-json'),
        },
        {
          label: 'Export as Text…',
          click: () => mainWindow && mainWindow.webContents.send('menu:export-txt'),
        },
        {
          label: 'Import JSON…',
          click: () => mainWindow && mainWindow.webContents.send('menu:import'),
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Close Window' } : { role: 'quit', label: 'Quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Write Tab',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow && mainWindow.webContents.send('menu:tab', 'write'),
        },
        {
          label: 'Library Tab',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow && mainWindow.webContents.send('menu:tab', 'library'),
        },
        {
          label: 'Focus Mode',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow && mainWindow.webContents.send('menu:tab', 'focus'),
        },
        {
          label: 'Insights Tab',
          accelerator: 'CmdOrCtrl+4',
          click: () => mainWindow && mainWindow.webContents.send('menu:tab', 'insights'),
        },
        {
          label: 'Settings Tab',
          accelerator: 'CmdOrCtrl+5',
          click: () => mainWindow && mainWindow.webContents.send('menu:tab', 'settings'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow && mainWindow.webContents.send('menu:cycle-theme'),
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          click: () => {
            if (!mainWindow) return;
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
        { type: 'separator' },
        { role: 'reload', label: 'Reload' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        {
          label: 'Focus the Page',
          accelerator: 'CmdOrCtrl+L',
          click: () => mainWindow && mainWindow.webContents.send('menu:focus-composer'),
        },
        {
          label: 'Search Entries',
          accelerator: 'CmdOrCtrl+K',
          click: () => mainWindow && mainWindow.webContents.send('menu:search'),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : []),
      ],
    },
    {
      role: 'help',
      label: 'Help',
      submenu: [
        {
          label: 'About The Quiet Page',
          click: () => mainWindow && mainWindow.webContents.send('menu:about'),
        },
        {
          label: 'Open Data Folder',
          click: () => {
            shell.openPath(app.getPath('userData'));
          },
        },
      ],
    },
  ];

  // User asked for the menu bar (File/Edit/View/Go/Window/Help) to be gone entirely.
  // Setting the application menu to null removes it completely.
  // Standard text-editing shortcuts (Ctrl+C/V/X/A/Z) still work in textareas
  // because Chromium handles them at the renderer level.
  Menu.setApplicationMenu(null);
}

/* ==========================================================================
   IPC handlers (storage + dialogs)
   ========================================================================== */

function registerIPC() {
  // ----- Entries -----
  ipcMain.handle('entries:load', async () => {
    return normalizeEntries(await readJSON(FILES.entries(), []));
  });

  ipcMain.handle('entries:save', async (_evt, entries) => {
    const ok = await writeJSON(FILES.entries(), normalizeEntries(entries));
    return ok;
  });

  // ----- Settings -----
  ipcMain.handle('settings:load', async () => {
    const stored = await readJSON(FILES.settings(), {});
    return normalizeSettings(stored);
  });

  ipcMain.handle('settings:save', async (_evt, settings) => {
    const ok = await writeJSON(FILES.settings(), normalizeSettings(settings));
    return ok;
  });

  // ----- Draft -----
  ipcMain.handle('draft:load', async () => {
    return await readText(FILES.draft(), '');
  });

  ipcMain.handle('draft:save', async (_evt, text) => {
    const t = typeof text === 'string' ? text : '';
    if (!t) {
      try { await fsp.unlink(FILES.draft()); } catch (_) {}
      return true;
    }
    return await writeText(FILES.draft(), t);
  });

  // ----- Export dialog -----
  ipcMain.handle('dialog:save-export', async (_evt, options) => {
    if (!mainWindow) return { canceled: true };
    const safeOptions = isPlainObject(options) ? options : {};
    const content = typeof safeOptions.content === 'string' ? safeOptions.content : '';
    if (Buffer.byteLength(content, 'utf8') > MAX_EXPORT_BYTES) {
      return { canceled: true, error: 'Export is too large.' };
    }
    const defaultName = path.basename(
      typeof safeOptions.defaultName === 'string' ? safeOptions.defaultName : 'quiet-page-export.txt'
    ).slice(0, 180);
    const filters = Array.isArray(safeOptions.filters) ? safeOptions.filters : undefined;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export',
      defaultPath: defaultName,
      filters: filters || [
        { name: 'JSON', extensions: ['json'] },
        { name: 'Text', extensions: ['txt'] },
      ],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    try {
      await fsp.writeFile(result.filePath, content, 'utf8');
      return { canceled: false, filePath: result.filePath };
    } catch (err) {
      return { canceled: true, error: err.message };
    }
  });

  // ----- Import dialog -----
  ipcMain.handle('dialog:open-import', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    try {
      const filePath = result.filePaths[0];
      const stat = await fsp.stat(filePath);
      if (stat.size > MAX_IMPORT_BYTES) {
        return { canceled: true, error: 'Import file is too large.' };
      }
      const raw = await fsp.readFile(filePath, 'utf8');
      return { canceled: false, content: raw, filePath: result.filePaths[0] };
    } catch (err) {
      return { canceled: true, error: err.message };
    }
  });

  // ----- Confirm dialog (for destructive actions) -----
  ipcMain.handle('dialog:confirm', async (_evt, { title, message, okLabel, cancelLabel }) => {
    if (!mainWindow) return false;
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: [cancelLabel || 'Cancel', okLabel || 'OK'],
      defaultId: 0,
      cancelId: 0,
      title: title || 'Confirm',
      message: message || 'Are you sure?',
    });
    return choice.response === 1;
  });

  // ----- Misc -----
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-data-path', () => app.getPath('userData'));
  ipcMain.handle('app:open-data-folder', () => shell.openPath(app.getPath('userData')));
}

/* ==========================================================================
   App lifecycle
   ========================================================================== */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    registerIPC();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
