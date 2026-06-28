/* ==========================================================================
   app.js — boots the renderer, wires global events
   ========================================================================== */

(function () {
  'use strict';

  function init() {
    // 1) Load storage (entries + settings) from disk
    window.QuietPageStorage.init().then(function () {
      var settings = window.QuietPageStorage.getSettings();

      // 2) Apply settings to <html> + sound engine
      window.QuietPageSettings.applyAll();
      window.QuietPageSound.init(settings);

      // 3) Init modules
      window.QuietPageSettings.init();
      window.QuietPageSettings.syncAllUI();
      window.QuietPageComposer.init();
      window.QuietPageEntries.init();
      window.QuietPageEntries.render();
      window.QuietPageLibrary.init();
      window.QuietPageLibrary.renderList();
      window.QuietPageFocus.init();
      window.QuietPageInsights.init();
      window.QuietPageTabs.init();
      window.QuietPageAmbient.init(settings);

      // 4) Set today's date + footer year
      var todayEl = document.getElementById('todayDate');
      if (todayEl) {
        var now = new Date();
        todayEl.textContent = window.QuietPageUtil.MONTHS[now.getMonth()] + ' ' + now.getFullYear();
      }
      var yearEl = document.getElementById('footerYear');
      if (yearEl) yearEl.textContent = window.QuietPageUtil.toRoman(new Date().getFullYear());

      // 5) Start on the writing page so the writer can type immediately.
      var initialTab = 'write';
      window.QuietPageTabs.switchTo(initialTab);

      // 6) App version
      var aboutVersion = document.getElementById('aboutVersion');
      if (aboutVersion) {
        window.QuietPage.app.getVersion().then(function (v) {
          aboutVersion.textContent = /^v/i.test(v) ? v : 'v' + v;
        });
      }

      // 7) Wire menu events from Electron main process
      wireMenuEvents();

      // 8) Wire internal events
      wireInternalEvents();

      // 9) Wire global keyboard shortcuts (non-menu)
      wireShortcuts();

      // 10) First interaction resumes audio context
      var firstInteractionDone = false;
      function firstInteraction() {
        if (firstInteractionDone) return;
        firstInteractionDone = true;
        window.QuietPageSound.ensureContext();
        window.QuietPageSound.resume();
      }
      document.addEventListener('click', firstInteraction);
      document.addEventListener('keydown', firstInteraction);
    }).catch(function (err) {
      console.error('Boot failed:', err);
    });
  }

  function wireMenuEvents() {
    if (!window.QuietPage || !window.QuietPage.menu) return;
    window.QuietPage.menu.on('menu:new-entry', function () {
      startNewEntry();
    });
    window.QuietPage.menu.on('menu:publish', function () {
      publishCurrent();
    });
    window.QuietPage.menu.on('menu:save-current', function () {
      saveCurrent();
    });
    window.QuietPage.menu.on('menu:export-json', function () {
      window.QuietPageTabs.switchTo('settings');
      window.QuietPageSettings.set('theme', window.QuietPageStorage.getSettings().theme); // noop to ensure settings tab is current
      // Call internal exportAll via settings module — exposed through set? No.
      // Re-implement here by re-using same logic.
      exportAllPublic('json');
    });
    window.QuietPage.menu.on('menu:export-txt', function () {
      exportAllPublic('txt');
    });
    window.QuietPage.menu.on('menu:import', function () {
      window.QuietPageTabs.switchTo('settings');
      // Trigger the hidden import path (replicate via dialog)
      importPublic();
    });
    window.QuietPage.menu.on('menu:tab', function (tab) {
      window.QuietPageTabs.switchTo(tab);
    });
    window.QuietPage.menu.on('menu:cycle-theme', function () {
      window.QuietPageSettings.cycleTheme();
    });
    window.QuietPage.menu.on('menu:toggle-focus', function () {
      window.QuietPageTabs.switchTo(window.QuietPageTabs.current() === 'focus' ? 'write' : 'focus');
    });
    window.QuietPage.menu.on('menu:focus-composer', function () {
      window.QuietPageTabs.switchTo('write');
      setTimeout(function () { window.QuietPageComposer.focus(); }, 100);
    });
    window.QuietPage.menu.on('menu:search', function () {
      focusLibrarySearch();
    });
    window.QuietPage.menu.on('menu:about', function () {
      window.QuietPageTabs.switchTo('settings');
      var about = document.querySelector('.about-section');
      if (about) about.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function startNewEntry() {
    if (window.QuietPageTabs.current() === 'focus') {
      window.QuietPageComposer.setText(window.QuietPageFocus.getText());
    }
    window.QuietPageTabs.switchTo('write');
    if (window.QuietPageComposer.getText().trim()) {
      window.QuietPageComposer.publish({ silent: true, playBell: false });
    } else {
      window.QuietPageComposer.clear();
    }
    setTimeout(function () { window.QuietPageComposer.focus(); }, 80);
  }

  function publishCurrent() {
    var tab = window.QuietPageTabs.current();
    if (tab === 'focus') {
      var evt = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true });
      document.getElementById('focusTextarea') && document.getElementById('focusTextarea').dispatchEvent(evt);
    } else if (tab === 'library' && window.QuietPageLibrary && window.QuietPageLibrary.saveCurrentEdit) {
      window.QuietPageLibrary.saveCurrentEdit();
    } else {
      window.QuietPageTabs.switchTo('write');
      window.QuietPageComposer.publish();
    }
  }

  function saveCurrent() {
    var tab = window.QuietPageTabs.current();
    if (tab === 'library' && window.QuietPageLibrary && window.QuietPageLibrary.saveCurrentEdit) {
      window.QuietPageLibrary.saveCurrentEdit();
      return;
    }
    if (tab === 'focus' && window.QuietPageFocus && window.QuietPageFocus.forceSaveDraft) {
      window.QuietPageFocus.forceSaveDraft().then(function () { QuietPageUtil.toast('Saved'); });
      return;
    }
    window.QuietPageTabs.switchTo('write');
    window.QuietPageComposer.forceSaveDraft();
  }

  function focusLibrarySearch() {
    window.QuietPageTabs.switchTo('library');
    setTimeout(function () {
      var s = document.getElementById('librarySearch');
      if (s) { s.focus(); s.select(); }
    }, 80);
  }

  // Export/Import exposed at module level for menu hooks
  function exportAllPublic(format) {
    // Re-use the same logic by clicking the hidden button
    var btn = format === 'json'
      ? document.getElementById('exportJsonBtn')
      : document.getElementById('exportTxtBtn');
    if (btn) btn.click();
  }

  function importPublic() {
    var btn = document.getElementById('importBtn');
    if (btn) btn.click();
  }

  function wireInternalEvents() {
    // Entries changed → refresh everything that depends on them
    document.addEventListener('quiet:entries-changed', function () {
      window.QuietPageEntries.render();
      window.QuietPageLibrary.refresh();
      // Insights only re-render if currently visible
      if (window.QuietPageTabs.current() === 'insights') {
        window.QuietPageInsights.render();
      }
    });

    // Open entry in Library tab
    document.addEventListener('quiet:open-in-library', function (e) {
      window.QuietPageTabs.switchTo('library');
      setTimeout(function () {
        window.QuietPageLibrary.openEntry(e.detail.id);
      }, 120);
    });

    // Switch tab from inside the renderer (e.g. Focus Esc key)
    document.addEventListener('quiet:switch-tab', function (e) {
      window.QuietPageTabs.switchTo(e.detail.tab);
    });
  }

  function wireShortcuts() {
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        startNewEntry();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrent();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        window.QuietPageTabs.switchTo(window.QuietPageTabs.current() === 'focus' ? 'write' : 'focus');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        focusLibrarySearch();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        exportAllPublic('json');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        window.QuietPageTabs.switchTo('library');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusLibrarySearch();
        return;
      }
      // Ctrl/Cmd + 1..5 → switch tabs
      if ((e.ctrlKey || e.metaKey) && ['1','2','3','4','5'].indexOf(e.key) !== -1) {
        e.preventDefault();
        var map = { '1':'write', '2':'library', '3':'focus', '4':'insights', '5':'settings' };
        window.QuietPageTabs.switchTo(map[e.key]);
        return;
      }
      // Ctrl/Cmd + T → cycle theme
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        window.QuietPageSettings.cycleTheme();
        return;
      }
      // Ctrl/Cmd + , → settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        window.QuietPageTabs.switchTo('settings');
        return;
      }
      if (e.key === 'Escape' && window.QuietPageTabs.current() === 'focus') {
        e.preventDefault();
        window.QuietPageTabs.switchTo('write');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
