/* ==========================================================================
   storage.js — File-backed storage via Electron IPC
   Replaces the original localStorage layer.
   ========================================================================== */

window.QuietPageStorage = (function () {
  'use strict';

  var DEFAULT_SETTINGS = {
    theme: 'sand',
    font: 'cormorant',
    size: 'medium',
    leading: 'normal',
    width: 'medium',
    soundEnabled: true,
    soundType: 'typewriter',
    volume: 40,
    bellOnPublish: true,
    enterToPublish: false, // Default: Ctrl+Enter = publish, Enter = new line
    autoSaveDraft: true,
    showWordCount: true,
    confirmDelete: false,
    activeTab: 'write',
    focusMode: false,
    windowBounds: null,
  };

  var _entriesCache = null;
  var _settingsCache = null;
  var _initDone = false;
  var _initPromise = null;

  function init() {
    if (_initPromise) return _initPromise;
    _initPromise = (async function () {
      try {
        var entries = await window.QuietPage.storage.loadEntries();
        _entriesCache = Array.isArray(entries) ? entries : [];
      } catch (e) {
        _entriesCache = [];
      }
      try {
        var settings = await window.QuietPage.storage.loadSettings();
        _settingsCache = mergeDefaults(settings);
      } catch (e) {
        _settingsCache = Object.assign({}, DEFAULT_SETTINGS);
      }
      _initDone = true;
    })();
    return _initPromise;
  }

  function mergeDefaults(stored) {
    var out = {};
    for (var k in DEFAULT_SETTINGS) {
      out[k] = (stored && stored[k] !== undefined && stored[k] !== null)
        ? stored[k]
        : DEFAULT_SETTINGS[k];
    }
    return out;
  }

  function getEntries() {
    return _entriesCache || [];
  }

  function setEntries(entries) {
    _entriesCache = entries || [];
    // Persist asynchronously, never throw
    window.QuietPage.storage.saveEntries(_entriesCache).catch(function (e) {
      console.warn('Failed to persist entries:', e);
    });
    return _entriesCache;
  }

  function getSettings() {
    return _settingsCache;
  }

  function setSettings(settings) {
    _settingsCache = settings;
    window.QuietPage.storage.saveSettings(_settingsCache).catch(function (e) {
      console.warn('Failed to persist settings:', e);
    });
    return _settingsCache;
  }

  function patchSettings(patch) {
    var merged = Object.assign({}, _settingsCache, patch);
    return setSettings(merged);
  }

  async function loadDraft() {
    try {
      return await window.QuietPage.storage.loadDraft() || '';
    } catch (e) {
      return '';
    }
  }

  async function saveDraft(text) {
    try {
      await window.QuietPage.storage.saveDraft(text || '');
    } catch (e) {
      console.warn('Failed to save draft:', e);
    }
  }

  return {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    init: init,
    isReady: function () { return _initDone; },
    getEntries: getEntries,
    setEntries: setEntries,
    getSettings: getSettings,
    setSettings: setSettings,
    patchSettings: patchSettings,
    loadDraft: loadDraft,
    saveDraft: saveDraft,
  };
})();
