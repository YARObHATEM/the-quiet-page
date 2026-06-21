/* ==========================================================================
   settings.js — Settings tab + quick theme cycle button
   ========================================================================== */

window.QuietPageSettings = (function () {
  'use strict';

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
    var clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAll);
  }

  function set(key, value) {
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
    html.setAttribute('data-font', s.font);
    html.setAttribute('data-size', s.size);
    html.setAttribute('data-leading', s.leading);
    html.setAttribute('data-width', s.width);
    QuietPageSound.updateSettings(s);
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
        entries: entries,
      };
      content = JSON.stringify(data, null, 2);
      defaultName = 'quiet-page-' + dateStr + '.json';
      filters = [{ name: 'JSON', extensions: ['json'] }];
    } else {
      var lines = [];
      lines.push('THE QUIET PAGE');
      lines.push('Exported ' + new Date().toLocaleString());
      lines.push('');
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var d = QuietPageUtil.formatEntryDate(e.createdAt);
        lines.push(d.month + ' ' + QuietPageUtil.ordinal(d.day) + ', ' + d.year + ' — ' + d.time);
        lines.push(new Array(40).join('─'));
        lines.push(e.text);
        lines.push('');
        lines.push('');
      }
      content = lines.join('\n');
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
          if (!source || typeof source !== 'object' || typeof source.text !== 'string') continue;
          var text = source.text.slice(0, 2000000);
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
          };
          var updatedAt = new Date(source.updatedAt);
          if (!isNaN(updatedAt.getTime())) e.updatedAt = updatedAt.toISOString();

          existing.push(e);
          existingIds[id] = true;
          count++;
        }
        QuietPageStorage.setEntries(existing);
        document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'import' } }));
        QuietPageUtil.toast('Imported ' + count + ' entries');
      } catch (err) {
        QuietPageUtil.toast('Could not import file', 'error');
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
