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

      // 4) Set today's date + footer year
      var todayEl = document.getElementById('todayDate');
      if (todayEl) {
        var now = new Date();
        todayEl.textContent = window.QuietPageUtil.MONTHS[now.getMonth()] + ' ' + now.getFullYear();
      }
      var yearEl = document.getElementById('footerYear');
      if (yearEl) yearEl.textContent = window.QuietPageUtil.toRoman(new Date().getFullYear());

      // 5) Restore last tab
      var initialTab = settings.activeTab || 'write';
      window.QuietPageTabs.switchTo(initialTab);

      // 6) App version
      var aboutVersion = document.getElementById('aboutVersion');
      if (aboutVersion) {
        window.QuietPage.app.getVersion().then(function (v) {
          aboutVersion.textContent = v;
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
      window.QuietPageTabs.switchTo('write');
      window.QuietPageComposer.clear();
      window.QuietPageComposer.focus();
    });
    window.QuietPage.menu.on('menu:publish', function () {
      if (window.QuietPageTabs.current() === 'focus') {
        // Trigger focus publish
        var evt = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true });
        document.getElementById('focusTextarea') && document.getElementById('focusTextarea').dispatchEvent(evt);
      } else {
        window.QuietPageComposer.publish();
      }
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
    window.QuietPage.menu.on('menu:focus-composer', function () {
      window.QuietPageTabs.switchTo('write');
      setTimeout(function () { window.QuietPageComposer.focus(); }, 100);
    });
    window.QuietPage.menu.on('menu:search', function () {
      var tab = window.QuietPageTabs.current();
      if (tab === 'library') {
        var s = document.getElementById('librarySearch');
        if (s) { s.focus(); s.select(); }
      } else {
        window.QuietPageTabs.switchTo('write');
        var w = document.getElementById('searchInput');
        if (w) { w.focus(); w.select(); }
      }
    });
    window.QuietPage.menu.on('menu:about', function () {
      window.QuietPageTabs.switchTo('settings');
      var about = document.querySelector('.about-text');
      if (about) about.scrollIntoView({ behavior: 'smooth' });
    });
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
      // Ctrl/Cmd + L → focus composer
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        window.QuietPageTabs.switchTo('write');
        setTimeout(function () { window.QuietPageComposer.focus(); }, 100);
        return;
      }
      // Ctrl/Cmd + K → search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        var tab = window.QuietPageTabs.current();
        if (tab === 'library') {
          var s = document.getElementById('librarySearch');
          if (s) { s.focus(); s.select(); }
        } else {
          window.QuietPageTabs.switchTo('write');
          var w = document.getElementById('searchInput');
          if (w) { w.focus(); w.select(); }
        }
        return;
      }
      // Ctrl/Cmd + , → settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        window.QuietPageTabs.switchTo('settings');
        return;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
