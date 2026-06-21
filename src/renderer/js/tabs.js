/* ==========================================================================
   tabs.js — Tab navigation in the sidebar
   ========================================================================== */

window.QuietPageTabs = (function () {
  'use strict';

  var navButtons = null;
  var panels = null;
  var currentTab = 'write';

  function init() {
    navButtons = document.querySelectorAll('.nav-item');
    panels = document.querySelectorAll('.tab-panel');

    for (var i = 0; i < navButtons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          switchTo(btn.getAttribute('data-tab'));
        });
      })(navButtons[i]);
    }
  }

  function switchTo(tab) {
    if (!tab) return;

    if (tab === 'focus' && currentTab === 'write') {
      window.QuietPageFocus.setText(window.QuietPageComposer.getText());
    } else if (tab === 'write' && currentTab === 'focus') {
      window.QuietPageComposer.setText(window.QuietPageFocus.getText());
    }

    currentTab = tab;

    if (navButtons) {
      for (var i = 0; i < navButtons.length; i++) {
        navButtons[i].classList.toggle('is-active', navButtons[i].getAttribute('data-tab') === tab);
      }
    }
    if (panels) {
      for (var j = 0; j < panels.length; j++) {
        panels[j].classList.toggle('is-active', panels[j].getAttribute('data-tab') === tab);
      }
    }

    // Persist active tab
    QuietPageStorage.patchSettings({ activeTab: tab });

    // Tab-specific activation hooks
    if (tab === 'write') {
      setTimeout(function () { window.QuietPageComposer && window.QuietPageComposer.focus(); }, 100);
    } else if (tab === 'focus') {
      setTimeout(function () { window.QuietPageFocus && window.QuietPageFocus.focus(); }, 100);
    } else if (tab === 'library') {
      window.QuietPageLibrary && window.QuietPageLibrary.refresh();
    } else if (tab === 'insights') {
      window.QuietPageInsights && window.QuietPageInsights.render();
    }
  }

  function current() { return currentTab; }

  return { init: init, switchTo: switchTo, current: current };
})();
