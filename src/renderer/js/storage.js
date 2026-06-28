/* ==========================================================================
   storage.js — File-backed storage via Electron IPC
   Replaces the original localStorage layer.
   ========================================================================== */

window.QuietPageStorage = (function () {
  'use strict';

  var DEFAULT_SETTINGS = {
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
    enterToPublish: false, // Default: Ctrl+Enter = publish, Enter = new line
    autoSaveDraft: true,
    showWordCount: true,
    confirmDelete: true,
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
        _entriesCache = normalizeEntries(entries);
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
    if (!stored || stored.englishFont === undefined || stored.englishFont === null) {
      out.englishFont = legacyEnglishFont(stored && stored.font);
    }
    return out;
  }

  function legacyEnglishFont(font) {
    if (font === 'newsreader') return 'newsreader';
    if (font === 'spectral') return 'spectral';
    return 'default';
  }

  function getEntries() {
    _entriesCache = normalizeEntries(_entriesCache);
    return _entriesCache;
  }

  function setEntries(entries) {
    _entriesCache = normalizeEntries(entries);
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

  function decodeDraft(raw) {
    if (!raw) return { text: '', html: '' };
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.quietPageDraft === 2 && typeof parsed.text === 'string') {
        return {
          text: parsed.text,
          html: typeof parsed.html === 'string' ? parsed.html : '',
        };
      }
    } catch (_) {}
    return { text: String(raw), html: '' };
  }

  async function loadDraftRecord() {
    try {
      return decodeDraft(await window.QuietPage.storage.loadDraft() || '');
    } catch (e) {
      return { text: '', html: '' };
    }
  }

  async function loadDraft() {
    var draft = await loadDraftRecord();
    return draft.text;
  }

  async function saveDraft(text, html) {
    try {
      var value = text || '';
      if (value && html) {
        value = JSON.stringify({ quietPageDraft: 2, text: value, html: html });
      }
      await window.QuietPage.storage.saveDraft(value);
    } catch (e) {
      console.warn('Failed to save draft:', e);
    }
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
    var seen = {};
    var tags = [];
    for (var i = 0; i < value.length; i++) {
      var tag = sanitizeTag(value[i]);
      if (!tag || seen[tag]) continue;
      seen[tag] = true;
      tags.push(tag);
      if (tags.length >= 12) break;
    }
    return tags;
  }

  function normalizeFolder(value) {
    var folder = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 48);
    return folder || 'Uncategorized';
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    var text = typeof entry.text === 'string'
      ? entry.text
      : (typeof entry.content === 'string' ? entry.content : '');
    var parts = window.extractTitleAndBody(text);

    entry.text = text;
    entry.title = parts.title;
    entry.body = parts.body;
    entry.wordCount = countWords(text);
    entry.tags = normalizeTags(entry.tags);
    entry.folder = normalizeFolder(entry.folder);
    if (typeof entry.html === 'string' && entry.html.trim() && window.QuietPageUtil && window.QuietPageUtil.sanitizeEntryHtml) {
      entry.html = window.QuietPageUtil.sanitizeEntryHtml(entry.html);
    } else {
      delete entry.html;
    }
    return entry;
  }

  function normalizeEntries(entries) {
    if (!Array.isArray(entries)) return [];
    var normalized = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = normalizeEntry(entries[i]);
      if (entry) normalized.push(entry);
    }
    return normalized;
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
    loadDraftRecord: loadDraftRecord,
    saveDraft: saveDraft,
    normalizeEntry: normalizeEntry,
    normalizeTags: normalizeTags,
    normalizeFolder: normalizeFolder,
    sanitizeTag: sanitizeTag,
  };
})();
