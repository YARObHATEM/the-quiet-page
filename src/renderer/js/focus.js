/* ==========================================================================
   focus.js — Focus tab: full-screen dedicated typing surface
   ========================================================================== */

window.QuietPageFocus = (function () {
  'use strict';

  var textarea = null;
  var dateEl = null;
  var counterEl = null;
  var draftTimer = null;
  var hasUserInput = false;

  function init() {
    textarea = document.getElementById('focusTextarea');
    dateEl = document.getElementById('focusDate');
    counterEl = document.getElementById('focusCounter');

    if (!textarea) return;

    if (dateEl) {
      var now = new Date();
      var month = window.QuietPageUtil.MONTHS[now.getMonth()];
      dateEl.textContent = month + ' ' + now.getFullYear();
    }

    if (window.QuietPageStorage.getSettings().autoSaveDraft) {
      window.QuietPageStorage.loadDraft().then(function (draft) {
        if (draft && !hasUserInput && !textarea.value) setText(draft);
      });
    }

    textarea.addEventListener('input', onInput);
    textarea.addEventListener('keydown', onKeyDown);
  }

  function onInput(e) {
    hasUserInput = true;
    if (e.inputType === 'insertText' && e.data) {
      window.QuietPageSound.playKey(e.data);
    } else if (e.inputType === 'insertParagraph') {
      window.QuietPageSound.playKey('Enter');
    } else if (e.inputType === 'deleteContentBackward') {
      window.QuietPageSound.playKey('Backspace');
    }
    updateCounter();
    scheduleDraftSave();
  }

  function onKeyDown(e) {
    // Esc → back to Write tab
    if (e.key === 'Escape') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('quiet:switch-tab', { detail: { tab: 'write' } }));
      return;
    }
    // Ctrl/Cmd+Enter → publish
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      publishFromFocus();
      return;
    }
    // Plain Enter → publish if enterToPublish is on
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var s = window.QuietPageStorage.getSettings();
      if (s.enterToPublish) {
        e.preventDefault();
        publishFromFocus();
      }
    }
  }

  function publishFromFocus() {
    var text = textarea.value.trim();
    if (!text) {
      QuietPageUtil.toast('Nothing to publish', 'error');
      return;
    }
    var entry = {
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      text: text,
      createdAt: new Date().toISOString(),
      pinned: false,
    };
    var entries = QuietPageStorage.getEntries();
    entries.push(entry);
    QuietPageStorage.setEntries(entries);

    textarea.value = '';
    QuietPageStorage.saveDraft('');
    updateCounter();

    window.QuietPageSound.playBell();
    document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'publish', entry: entry } }));
    QuietPageUtil.toast('Published');
  }

  function updateCounter() {
    if (!counterEl) return;
    var t = textarea.value;
    counterEl.textContent = QuietPageUtil.countWords(t) + ' words · ' + t.length + ' chars';
  }

  function scheduleDraftSave() {
    if (!window.QuietPageStorage.getSettings().autoSaveDraft) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      window.QuietPageStorage.saveDraft(textarea.value);
    }, 1000);
  }

  function focus() {
    if (textarea) {
      textarea.focus();
      // Move cursor to end
      var len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    }
  }

  function getText() {
    return textarea ? textarea.value : '';
  }

  function setText(text) {
    if (!textarea) return;
    textarea.value = typeof text === 'string' ? text : '';
    updateCounter();
  }

  return {
    init: init,
    focus: focus,
    getText: getText,
    setText: setText,
  };
})();
