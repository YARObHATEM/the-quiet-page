/* ==========================================================================
   settings.js — Settings tab + quick theme cycle button
   ========================================================================== */

window.QuietPageSettings = (function () {
  'use strict';

  var UI_SCALE_STEPS = [85, 90, 100, 110, 115];
  var previewUiScale = 100;

  function init() {
    // Theme swatches
    var swatches = document.querySelectorAll('.theme-swatch');
    for (var i = 0; i < swatches.length; i++) {
      (function (sw) {
        sw.addEventListener('click', function () {
          set('theme', sw.getAttribute('data-theme-val'));
        });
      })(swatches[i]);
    }

    // Toggles
    var toggles = document.querySelectorAll('[data-toggle]');
    for (var j = 0; j < toggles.length; j++) {
      (function (t) {
        t.addEventListener('click', function () {
          var key = t.getAttribute('data-toggle');
          var current = QuietPageStorage.getSettings()[key];
          set(key, !current);
        });
      })(toggles[j]);
    }

    // Segmented controls
    var segmenteds = document.querySelectorAll('[data-setting]');
    for (var k = 0; k < segmenteds.length; k++) {
      (function (seg) {
        var key = seg.getAttribute('data-setting');
        var btns = seg.querySelectorAll('button');
        for (var m = 0; m < btns.length; m++) {
          (function (btn) {
            btn.addEventListener('click', function () {
              set(key, btn.getAttribute('data-val'));
            });
          })(btns[m]);
        }
      })(segmenteds[k]);
    }

    // Font dropdowns
    var selects = document.querySelectorAll('select[data-setting]');
    for (var n = 0; n < selects.length; n++) {
      (function (select) {
        select.addEventListener('change', function () {
          set(select.getAttribute('data-setting'), select.value);
        });
      })(selects[n]);
    }

    // Volume slider
    var volumeRange = document.getElementById('volumeRange');
    if (volumeRange) {
      volumeRange.addEventListener('input', function () {
        var v = parseInt(volumeRange.value, 10);
        document.getElementById('volumeValue').textContent = v;
        set('volume', v);
      });
    }

    // Test sound
    var testBtn = document.getElementById('testSoundBtn');
    if (testBtn) {
      testBtn.addEventListener('click', function () {
        QuietPageSound.testSound();
      });
    }

    // Quick theme cycle button (sidebar)
    var quickTheme = document.getElementById('quickTheme');
    if (quickTheme) {
      quickTheme.addEventListener('click', cycleTheme);
    }

    var uiScaleRange = document.getElementById('uiScaleRange');
    var uiScaleApply = document.getElementById('uiScaleApply');
    if (uiScaleRange) {
      uiScaleRange.addEventListener('input', function () {
        var index = Math.min(UI_SCALE_STEPS.length - 1, Math.max(0, parseInt(uiScaleRange.value, 10) || 0));
        previewUiScale = UI_SCALE_STEPS[index];
        var valueEl = document.getElementById('uiScaleValue');
        if (valueEl) valueEl.textContent = previewUiScale + '%';
        if (uiScaleApply) uiScaleApply.disabled = previewUiScale === normalizeUiScale(QuietPageStorage.getSettings().uiScale);
      });
    }
    if (uiScaleApply) {
      uiScaleApply.addEventListener('click', function () {
        set('uiScale', previewUiScale);
      });
    }

    // Export / Import / Open data / Clear
    var exportJson = document.getElementById('exportJsonBtn');
    if (exportJson) exportJson.addEventListener('click', function () { exportAll('json'); });
    var exportTxt = document.getElementById('exportTxtBtn');
    if (exportTxt) exportTxt.addEventListener('click', function () { exportAll('txt'); });
    var importBtn = document.getElementById('importBtn');
    if (importBtn) importBtn.addEventListener('click', function () { importData(); });
    var openDataBtn = document.getElementById('openDataBtn');
    if (openDataBtn) openDataBtn.addEventListener('click', function () {
      window.QuietPage.app.openDataFolder();
    });
    var aboutOpenDataBtn = document.getElementById('aboutOpenDataBtn');
    if (aboutOpenDataBtn) aboutOpenDataBtn.addEventListener('click', function () {
      window.QuietPage.app.openDataFolder();
    });
    var clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAll);

    loadAboutInfo();
  }

  function loadAboutInfo() {
    var dataPathEl = document.getElementById('aboutDataPath');
    if (dataPathEl && window.QuietPage && window.QuietPage.app && window.QuietPage.app.getDataPath) {
      window.QuietPage.app.getDataPath().then(function (path) {
        dataPathEl.textContent = path || 'Unavailable';
      });
    }
  }

  function set(key, value) {
    if (key === 'uiScale') value = normalizeUiScale(value);
    var patch = {};
    patch[key] = value;
    QuietPageStorage.patchSettings(patch);
    if (key === 'autoSaveDraft' && value === false) {
      QuietPageStorage.saveDraft('');
    }
    applyAll();
    syncUI(key, value);
  }

  function applyAll() {
    var s = QuietPageStorage.getSettings();
    var html = document.documentElement;
    html.setAttribute('data-theme', s.theme);
    // Keep the legacy attribute for compatibility with existing settings/backups.
    html.setAttribute('data-font', s.font);
    html.setAttribute('data-english-font', s.englishFont);
    html.setAttribute('data-arabic-font', s.arabicFont);
    html.setAttribute('data-size', s.size);
    html.setAttribute('data-leading', s.leading);
    html.setAttribute('data-width', s.width);
    var scaleRoot = document.getElementById('appScaleRoot');
    if (scaleRoot) scaleRoot.style.setProperty('--ui-scale', String(normalizeUiScale(s.uiScale) / 100));
    QuietPageSound.updateSettings(s);
    if (window.QuietPageAmbient) QuietPageAmbient.updateSettings(s);
  }

  function syncUI(key, value) {
    var toggle = document.querySelector('[data-toggle="' + key + '"]');
    if (toggle) {
      toggle.classList.toggle('is-on', !!value);
    }
    var seg = document.querySelector('[data-setting="' + key + '"]');
    if (seg) {
      var btns = seg.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('is-active', btns[i].getAttribute('data-val') === value);
      }
    }
    var select = document.querySelector('select[data-setting="' + key + '"]');
    if (select) select.value = value;
    if (key === 'theme') {
      var swatches = document.querySelectorAll('.theme-swatch');
      for (var j = 0; j < swatches.length; j++) {
        swatches[j].classList.toggle('is-active', swatches[j].getAttribute('data-theme-val') === value);
      }
    }
    if (key === 'volume') {
      var range = document.getElementById('volumeRange');
      var val = document.getElementById('volumeValue');
      if (range) range.value = value;
      if (val) val.textContent = value;
    }
    if (key === 'uiScale') {
      var scale = normalizeUiScale(value);
      previewUiScale = scale;
      var scaleRange = document.getElementById('uiScaleRange');
      var scaleValue = document.getElementById('uiScaleValue');
      var scaleApply = document.getElementById('uiScaleApply');
      var scaleIndex = UI_SCALE_STEPS.indexOf(scale);
      if (scaleRange) scaleRange.value = scaleIndex === -1 ? 2 : scaleIndex;
      if (scaleValue) scaleValue.textContent = scale + '%';
      if (scaleApply) scaleApply.disabled = true;
    }
    if (key === 'enterToPublish') {
      var sc = document.getElementById('shortcutPublish');
      if (sc) sc.textContent = value ? 'Enter' : 'Ctrl + Enter';
    }
  }

  function syncAllUI() {
    var s = QuietPageStorage.getSettings();
    for (var k in s) {
      if (s.hasOwnProperty(k)) syncUI(k, s[k]);
    }
  }

  function cycleTheme() {
    var current = QuietPageStorage.getSettings().theme;
    var idx = QuietPageUtil.THEMES.indexOf(current);
    var next = QuietPageUtil.THEMES[(idx + 1) % QuietPageUtil.THEMES.length];
    set('theme', next);
    QuietPageUtil.toast(next);
  }

  function normalizeUiScale(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return 100;
    number = Math.round(number);
    return UI_SCALE_STEPS.indexOf(number) === -1 ? 100 : number;
  }

  /* ----- Export / Import ----- */

  function exportAll(format) {
    var entries = QuietPageStorage.getEntries();
    if (entries.length === 0) {
      QuietPageUtil.toast('Nothing to export', 'error');
      return;
    }
    var dateStr = QuietPageUtil.formatDateForFile(new Date());
    var content, defaultName, filters;

    if (format === 'json') {
      var data = {
        app: 'The Quiet Page',
        exported: new Date().toISOString(),
        count: entries.length,
        entries: entries.map(exportEntry),
      };
      content = JSON.stringify(data, null, 2);
      defaultName = 'quiet-page-' + dateStr + '.json';
      filters = [{ name: 'JSON', extensions: ['json'] }];
    } else {
      var blocks = [];
      for (var i = 0; i < entries.length; i++) {
        var entryParts = [];
        entryParts.push('Folder: ' + QuietPageStorage.normalizeFolder(entries[i].folder));
        var tags = QuietPageStorage.normalizeTags(entries[i].tags);
        if (tags.length) entryParts.push('Tags: ' + tags.join(', '));
        if (entries[i].title) entryParts.push(entries[i].title);
        if (entries[i].body) entryParts.push(entries[i].body);
        blocks.push(entryParts.join('\n\n'));
      }
      content = blocks.join('\n\n---\n\n');
      defaultName = 'quiet-page-' + dateStr + '.txt';
      filters = [{ name: 'Text', extensions: ['txt'] }];
    }

    window.QuietPage.dialog.saveExport({
      defaultName: defaultName,
      filters: filters,
      content: content,
    }).then(function (res) {
      if (!res.canceled) QuietPageUtil.toast('Exported ' + entries.length + ' entries');
    });
  }

  function exportEntry(entry) {
    return {
      id: entry.id,
      title: entry.title || '',
      text: entry.text || '',
      html: entry.html || '',
      body: entry.body || '',
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      wordCount: entry.wordCount || QuietPageUtil.countWords(entry.text || ''),
      pinned: entry.pinned === true,
      tags: QuietPageStorage.normalizeTags(entry.tags),
      folder: QuietPageStorage.normalizeFolder(entry.folder),
    };
  }

  function importData() {
    window.QuietPage.dialog.openImport().then(function (res) {
      if (res.canceled) return;
      try {
        var data = JSON.parse(res.content);
        var imported;
        if (Array.isArray(data)) imported = data;
        else if (data.entries && Array.isArray(data.entries)) imported = data.entries;
        else throw new Error('Invalid format');

        var existing = QuietPageStorage.getEntries();
        var existingIds = {};
        for (var i = 0; i < existing.length; i++) existingIds[existing[i].id] = true;

        var count = 0;
        for (var j = 0; j < imported.length; j++) {
          var source = imported[j];
          if (!source || typeof source !== 'object') continue;
          var sourceText = typeof source.text === 'string'
            ? source.text
            : (typeof source.content === 'string' ? source.content : '');
          var text = sourceText.slice(0, 2000000);
          if (!text.trim()) continue;
          var createdAt = new Date(source.createdAt);
          if (isNaN(createdAt.getTime())) continue;

          var id;
          do {
            id = 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9) + '_' + j;
          } while (existingIds[id]);

          var e = {
            id: id,
            text: text,
            createdAt: createdAt.toISOString(),
            pinned: source.pinned === true,
            tags: QuietPageStorage.normalizeTags(source.tags),
            folder: QuietPageStorage.normalizeFolder(source.folder),
          };
          if (typeof source.html === 'string') e.html = source.html.slice(0, 4000000);
          var updatedAt = new Date(source.updatedAt);
          if (!isNaN(updatedAt.getTime())) e.updatedAt = updatedAt.toISOString();

          existing.push(QuietPageStorage.normalizeEntry(e));
          existingIds[id] = true;
          count++;
        }
        QuietPageStorage.setEntries(existing);
        document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'import' } }));
        QuietPageUtil.toast(count ? 'Imported ' + count + ' entries' : 'No entries found in that file');
      } catch (err) {
        QuietPageUtil.toast('That JSON file could not be read', 'error');
      }
    });
  }

  function clearAll() {
    var entries = QuietPageStorage.getEntries();
    if (entries.length === 0) {
      QuietPageUtil.toast('Already empty');
      return;
    }
    window.QuietPage.dialog.confirm({
      title: 'Clear all entries?',
      message: 'Remove all ' + entries.length + ' entries? This cannot be undone.',
      okLabel: 'Clear All',
      cancelLabel: 'Cancel',
    }).then(function (ok) {
      if (!ok) return;
      QuietPageStorage.setEntries([]);
      document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'clear' } }));
      QuietPageUtil.toast('All entries cleared');
    });
  }

  return {
    init: init,
    applyAll: applyAll,
    syncAllUI: syncAllUI,
    set: set,
    cycleTheme: cycleTheme,
  };
})();
