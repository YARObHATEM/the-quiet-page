/* ==========================================================================
   composer.js — the "Today's Page" textarea (Write tab)
   Handles input, sounds, draft autosave, publishing.
   ========================================================================== */

window.QuietPageComposer = (function () {
  'use strict';

  var el = null;
  var publishBtn = null;
  var wordCountEl = null;
  var charCountEl = null;
  var dirBadgeEl = null;
  var savedBadgeEl = null;
  var writingIndicatorEl = null;
  var draftTimer = null;
  var writingTimer = null;
  var hasUserInput = false;

  function init() {
    el = document.getElementById('composer');
    publishBtn = document.getElementById('publishBtn');
    wordCountEl = document.getElementById('wordCount');
    charCountEl = document.getElementById('charCount');
    dirBadgeEl = document.getElementById('dirBadge');
    savedBadgeEl = document.getElementById('savedBadge');
    writingIndicatorEl = document.getElementById('writingIndicator');

    if (!el || !publishBtn) {
      console.warn('Composer elements missing');
      return;
    }

    // Restore draft (async)
    if (window.QuietPageStorage.getSettings().autoSaveDraft) {
      window.QuietPageStorage.loadDraft().then(function (draft) {
        if (draft && !hasUserInput && !el.value) setText(draft);
      });
    }

    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKeyDown);
    publishBtn.addEventListener('click', publish);

    updateState();
    autoResize();
  }

  function onInput(e) {
    hasUserInput = true;
    if (e.inputType === 'insertText' && e.data) {
      window.QuietPageSound.playKey(e.data);
    } else if (e.inputType === 'insertParagraph') {
      window.QuietPageSound.playKey('Enter');
    } else if (e.inputType === 'insertFromPaste') {
      // No sound on paste
    } else if (e.inputType === 'deleteContentBackward') {
      window.QuietPageSound.playKey('Backspace');
    }
    updateState();
    autoResize();
    scheduleDraftSave();
    activateWritingIndicator();
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      var s = window.QuietPageStorage.getSettings();
      if (s.enterToPublish) {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          publish();
          return;
        }
      } else {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          publish();
          return;
        }
      }
    }
  }

  function updateState() {
    var text = el.value;
    var trimmed = text.trim();

    if (wordCountEl) wordCountEl.textContent = QuietPageUtil.countWords(text);
    if (charCountEl) charCountEl.textContent = text.length;

    if (trimmed) {
      var dir = QuietPageUtil.detectDirection(text);
      if (dirBadgeEl) {
        dirBadgeEl.style.display = 'inline-block';
        dirBadgeEl.textContent = QuietPageUtil.langLabel(dir);
      }
      if (el.dir !== dir) el.dir = dir;
    } else {
      if (dirBadgeEl) dirBadgeEl.style.display = 'none';
      el.dir = 'auto';
    }

    publishBtn.disabled = !trimmed;
  }

  function autoResize() {
    el.style.height = 'auto';
    var newHeight = Math.max(el.scrollHeight, 240);
    if (newHeight > 600) newHeight = 600;
    el.style.height = newHeight + 'px';
  }

  function scheduleDraftSave() {
    if (!window.QuietPageStorage.getSettings().autoSaveDraft) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      window.QuietPageStorage.saveDraft(el.value);
      showSavedBadge();
    }, 1000);
  }

  function showSavedBadge() {
    if (!savedBadgeEl) return;
    savedBadgeEl.classList.add('is-visible');
    setTimeout(function () { savedBadgeEl.classList.remove('is-visible'); }, 1500);
  }

  function activateWritingIndicator() {
    if (!writingIndicatorEl) return;
    writingIndicatorEl.classList.add('is-active');
    clearTimeout(writingTimer);
    writingTimer = setTimeout(function () {
      writingIndicatorEl.classList.remove('is-active');
    }, 1200);
  }

  function publish() {
    var text = el.value.trim();
    if (!text) return;

    var entry = {
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      text: text,
      createdAt: new Date().toISOString(),
      pinned: false,
    };

    var entries = QuietPageStorage.getEntries();
    entries.push(entry);
    QuietPageStorage.setEntries(entries);

    el.value = '';
    QuietPageStorage.saveDraft('');
    updateState();
    autoResize();

    QuietPageSound.playBell();

    // Notify other modules
    document.dispatchEvent(new CustomEvent('quiet:entries-changed', {
      detail: { action: 'publish', entry: entry }
    }));

    QuietPageUtil.toast('Published');

    // Scroll to new entry
    setTimeout(function () {
      var newEl = document.querySelector('.entry[data-id="' + entry.id + '"]');
      if (newEl) {
        newEl.classList.add('is-new');
        newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  }

  function focus() {
    if (el) el.focus();
  }

  function clear() {
    setText('');
    QuietPageStorage.saveDraft('');
  }

  function getText() {
    return el ? el.value : '';
  }

  function setText(text) {
    if (!el) return;
    el.value = typeof text === 'string' ? text : '';
    updateState();
    autoResize();
  }

  return {
    init: init,
    focus: focus,
    clear: clear,
    publish: publish,
    getText: getText,
    setText: setText,
  };
})();
