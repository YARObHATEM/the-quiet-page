/* ==========================================================================
   composer.js — the "Today's Page" textarea (Write tab)
   Handles input, sounds, draft autosave, publishing.
   ========================================================================== */

window.QuietPageComposer = (function () {
  'use strict';

  var el = null;
  var composerWrap = null;
  var publishBtn = null;
  var wordCountEl = null;
  var charCountEl = null;
  var dirBadgeEl = null;
  var savedBadgeEl = null;
  var writingIndicatorEl = null;
  var folderInputEl = null;
  var tagInputEl = null;
  var tagListEl = null;
  var draftTimer = null;
  var saveBadgeTimer = null;
  var typewriterTimer = null;
  var writingTimer = null;
  var hasUserInput = false;
  var isComposing = false;
  var currentTags = [];

  function init() {
    el = document.getElementById('composer');
    composerWrap = el ? el.closest('.composer') : null;
    publishBtn = document.getElementById('publishBtn');
    wordCountEl = document.getElementById('wordCount');
    charCountEl = document.getElementById('charCount');
    dirBadgeEl = document.getElementById('dirBadge');
    savedBadgeEl = document.getElementById('savedBadge');
    writingIndicatorEl = document.getElementById('writingIndicator');
    folderInputEl = document.getElementById('composerFolder');
    tagInputEl = document.getElementById('composerTagInput');
    tagListEl = document.getElementById('composerTagList');

    if (!el || !publishBtn) {
      console.warn('Composer elements missing');
      return;
    }

    renderEditorText('');

    // Restore draft (async)
    if (window.QuietPageStorage.getSettings().autoSaveDraft) {
      window.QuietPageStorage.loadDraftRecord().then(function (draft) {
        if (draft.text && !hasUserInput && !getText()) {
          setFormattedContent(draft.text, draft.html);
          focus();
        }
      });
    }

    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKeyDown);
    wireFormattingToolbar();
    if (tagInputEl) {
      tagInputEl.addEventListener('keydown', onTagInputKeydown);
      tagInputEl.addEventListener('input', onTagInputChanged);
    }
    el.addEventListener('compositionstart', function () { isComposing = true; });
    el.addEventListener('compositionend', function () {
      isComposing = false;
      normalizeEditorStructure();
      updateState();
      autoResize();
      scheduleTypewriterScroll();
    });
    publishBtn.addEventListener('click', function () { publish(); });
    document.addEventListener('selectionchange', updateFormattingState);

    updateState();
    renderTags();
    autoResize();
    setTimeout(function () { focus(); }, 60);
  }

  function onInput(e) {
    hasUserInput = true;
    if (!isComposing) normalizeEditorStructure();
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
    notifyDraftChanged();
    autoResize();
    scheduleDraftSave();
    scheduleTypewriterScroll();
    activateWritingIndicator();
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      var shortcut = e.key.toLowerCase();
      if (shortcut === 'b' || shortcut === 'i' || shortcut === 'u') {
        e.preventDefault();
        applyFormat(shortcut === 'b' ? 'bold' : (shortcut === 'i' ? 'italic' : 'underline'));
        return;
      }
    }
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

  function onTagInputKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInputEl.value);
    } else if (e.key === 'Backspace' && !tagInputEl.value && currentTags.length) {
      currentTags.pop();
      renderTags();
    }
  }

  function onTagInputChanged() {
    if (!tagInputEl || tagInputEl.value.indexOf(',') === -1) return;
    var parts = tagInputEl.value.split(',');
    for (var i = 0; i < parts.length - 1; i++) addTag(parts[i], true);
    tagInputEl.value = parts[parts.length - 1];
    renderTags();
  }

  function addTag(value, keepInput) {
    var tags = QuietPageStorage.normalizeTags(currentTags.concat([value]));
    currentTags = tags;
    if (!keepInput && tagInputEl) tagInputEl.value = '';
    renderTags();
  }

  function removeTag(tag) {
    currentTags = currentTags.filter(function (t) { return t !== tag; });
    renderTags();
  }

  function renderTags() {
    if (!tagListEl) return;
    var html = '';
    for (var i = 0; i < currentTags.length; i++) {
      html += '<span class="tag-chip">' + QuietPageUtil.escapeHtml(currentTags[i]) +
              '<button class="tag-chip-remove" type="button" data-tag="' + QuietPageUtil.escapeHtml(currentTags[i]) + '" aria-label="Remove tag">×</button></span>';
    }
    tagListEl.innerHTML = html;
    var removeBtns = tagListEl.querySelectorAll('.tag-chip-remove');
    for (var j = 0; j < removeBtns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () { removeTag(btn.getAttribute('data-tag')); });
      })(removeBtns[j]);
    }
  }

  function updateState() {
    var text = getText();
    var trimmed = text.trim();
    var dir = QuietPageUtil.detectDirection(text);

    if (wordCountEl) wordCountEl.textContent = QuietPageUtil.countWords(text) + ' words';
    if (charCountEl) charCountEl.textContent = text.length;

    if (trimmed) {
      if (dirBadgeEl) {
        dirBadgeEl.style.display = 'inline-block';
        dirBadgeEl.textContent = QuietPageUtil.langLabel(dir);
      }
    } else {
      if (dirBadgeEl) dirBadgeEl.style.display = 'none';
    }

    if (el.dir !== dir) el.dir = dir;
    el.dataset.direction = dir;
    if (composerWrap) composerWrap.dataset.composerDir = dir;
    publishBtn.disabled = !trimmed;
  }

  function autoResize() {
    el.style.height = 'auto';
    el.style.overflowY = 'visible';
  }

  function scheduleDraftSave() {
    if (!window.QuietPageStorage.getSettings().autoSaveDraft) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      forceSaveDraft();
    }, 1000);
  }

  function forceSaveDraft() {
    clearTimeout(draftTimer);
    showSavingBadge();
    return Promise.resolve(window.QuietPageStorage.saveDraft(getText(), getHtml())).then(function () {
      window.setTimeout(showSavedBadge, 300);
    });
  }

  function showSavingBadge() {
    if (!savedBadgeEl) return;
    clearTimeout(saveBadgeTimer);
    savedBadgeEl.textContent = 'Saving...';
    savedBadgeEl.classList.add('is-visible');
  }

  function showSavedBadge() {
    if (!savedBadgeEl) return;
    clearTimeout(saveBadgeTimer);
    savedBadgeEl.textContent = 'Saved';
    savedBadgeEl.classList.add('is-visible');
    saveBadgeTimer = setTimeout(function () { savedBadgeEl.classList.remove('is-visible'); }, 1500);
  }

  function activateWritingIndicator() {
    if (!writingIndicatorEl) return;
    writingIndicatorEl.classList.add('is-active');
    clearTimeout(writingTimer);
    writingTimer = setTimeout(function () {
      writingIndicatorEl.classList.remove('is-active');
    }, 1200);
  }

  function publish(options) {
    options = options || {};
    var text = getText().trim();
    if (!text) return null;
    var parts = window.extractTitleAndBody(text);

    var entry = {
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      text: text,
      title: parts.title,
      body: parts.body,
      wordCount: QuietPageUtil.countWords(text),
      createdAt: new Date().toISOString(),
      pinned: false,
      tags: QuietPageStorage.normalizeTags(currentTags),
      folder: QuietPageStorage.normalizeFolder(folderInputEl && folderInputEl.value),
      html: getHtml(),
    };

    var entries = QuietPageStorage.getEntries();
    entries.push(entry);
    QuietPageStorage.setEntries(entries);

    clear();
    QuietPageStorage.saveDraft('');

    if (options.playBell !== false) QuietPageSound.playBell();

    // Notify other modules
    document.dispatchEvent(new CustomEvent('quiet:entries-changed', {
      detail: { action: 'publish', entry: entry }
    }));

    if (!options.silent) QuietPageUtil.toast('Published');

    // Scroll to new entry
    if (!options.silent) {
      setTimeout(function () {
        var newEl = document.querySelector('.entry[data-id="' + entry.id + '"]');
        if (newEl) {
          newEl.classList.add('is-new');
          newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    }

    return entry;
  }

  function focus(position) {
    if (!el) return;
    el.focus();
    setCaretOffset(position === 'start' ? 0 : getText().length);
  }

  function clear() {
    setText('');
    currentTags = [];
    renderTags();
    if (tagInputEl) tagInputEl.value = '';
    if (folderInputEl) folderInputEl.value = '';
    updateState();
    autoResize();
    QuietPageStorage.saveDraft('');
    notifyDraftChanged();
  }

  function getText() {
    return el ? readEditorText() : '';
  }

  function setText(text) {
    if (!el) return;
    renderEditorText(typeof text === 'string' ? text : '');
    updateState();
    autoResize();
    notifyDraftChanged();
  }

  function setFormattedContent(text, html) {
    if (!el) return;
    var safe = QuietPageUtil.sanitizeEntryHtml(html || '');
    if (safe) {
      var template = document.createElement('template');
      template.innerHTML = safe;
      var children = Array.prototype.slice.call(template.content.children);
      if (children.length && children.every(function (node) { return node.tagName === 'DIV'; })) {
        el.innerHTML = safe;
        updateTitleTreatment();
      } else {
        renderEditorText(text || '');
      }
    } else {
      renderEditorText(text || '');
    }
    updateState();
    autoResize();
    notifyDraftChanged();
  }

  function getHtml() {
    if (!el || !getText().trim()) return '';
    var clone = el.cloneNode(true);
    var automatic = clone.querySelectorAll('.composer-title-line, .has-body, .composer-blank-line');
    for (var i = 0; i < automatic.length; i++) {
      automatic[i].classList.remove('composer-title-line', 'has-body', 'composer-blank-line');
    }
    return QuietPageUtil.sanitizeEntryHtml(clone.innerHTML);
  }

  function wireFormattingToolbar() {
    var buttons = document.querySelectorAll('.formatting-btn[data-format]');
    for (var i = 0; i < buttons.length; i++) {
      (function (button) {
        button.addEventListener('mousedown', function (e) { e.preventDefault(); });
        button.addEventListener('click', function () {
          applyFormat(button.getAttribute('data-format'));
        });
      })(buttons[i]);
    }
  }

  function applyFormat(format) {
    if (!el) return;
    if (format === 'heading-1' || format === 'heading-2') {
      applyHeading(format === 'heading-1' ? 'format-heading-1' : 'format-heading-2');
    } else {
      if (!selectionInsideComposer()) focus();
      document.execCommand(format, false, null);
    }
    updateTitleTreatment();
    updateState();
    notifyDraftChanged();
    scheduleDraftSave();
    updateFormattingState();
  }

  function applyHeading(className) {
    if (!selectionInsideComposer()) focus();
    var line = getCurrentLineElement();
    if (!line) return;
    var wasActive = line.classList.contains(className);
    line.classList.remove('format-heading-1', 'format-heading-2');
    if (!wasActive) line.classList.add(className);
  }

  function selectionInsideComposer() {
    var selection = window.getSelection();
    return !!(selection && selection.rangeCount && el.contains(selection.anchorNode));
  }

  function updateFormattingState() {
    if (!el) return;
    var line = selectionInsideComposer() ? getCurrentLineElement() : null;
    var buttons = document.querySelectorAll('.formatting-btn[data-format]');
    for (var i = 0; i < buttons.length; i++) {
      var format = buttons[i].getAttribute('data-format');
      var active = false;
      if (format === 'heading-1') active = !!(line && line.classList.contains('format-heading-1'));
      else if (format === 'heading-2') active = !!(line && line.classList.contains('format-heading-2'));
      else if (selectionInsideComposer()) active = document.queryCommandState(format);
      buttons[i].classList.toggle('is-active', active);
      buttons[i].setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function notifyDraftChanged() {
    document.dispatchEvent(new CustomEvent('quiet:draft-changed'));
  }

  function readEditorText() {
    if (!el || !el.childNodes.length) return '';
    if (hasLineStructure()) {
      var lines = [];
      for (var i = 0; i < el.children.length; i++) {
        lines.push(el.children[i].textContent || '');
      }
      return lines.join('\n').replace(/\u00a0/g, ' ');
    }
    return (el.innerText || el.textContent || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/\n$/, '');
  }

  function hasLineStructure() {
    if (!el || !el.childNodes.length) return false;
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType !== 1 || node.tagName !== 'DIV') return false;
      if ((node.textContent || '').indexOf('\n') !== -1) return false;
      if (node.querySelector('div, p')) return false;
    }
    return true;
  }

  function normalizeEditorStructure() {
    if (hasLineStructure()) {
      updateTitleTreatment();
      return;
    }
    var text = readEditorText();
    var caret = getCaretOffset();
    renderEditorText(text, caret);
  }

  function renderEditorText(text, caretOffset) {
    var normalized = typeof text === 'string' ? text.replace(/\r\n?/g, '\n') : '';
    var lines = normalized.split('\n');
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < lines.length; i++) {
      var line = document.createElement('div');
      if (lines[i]) line.textContent = lines[i];
      else {
        line.className = 'composer-blank-line';
        line.appendChild(document.createElement('br'));
      }
      fragment.appendChild(line);
    }

    el.replaceChildren(fragment);
    updateTitleTreatment();
    if (typeof caretOffset === 'number') setCaretOffset(caretOffset);
  }

  function updateTitleTreatment() {
    if (!el) return;
    var titleIndex = -1;
    for (var i = 0; i < el.children.length; i++) {
      var line = el.children[i];
      var hasText = !!(line.textContent || '').trim();
      line.classList.remove('composer-title-line', 'has-body', 'composer-blank-line');
      if (!hasText) line.classList.add('composer-blank-line');
      if (titleIndex === -1 && hasText) titleIndex = i;
    }

    if (titleIndex !== -1) {
      var titleLine = el.children[titleIndex];
      titleLine.classList.add('composer-title-line');
      if (titleIndex < el.children.length - 1) titleLine.classList.add('has-body');
    }

    el.setAttribute('data-empty', readEditorText().trim() ? 'false' : 'true');
  }

  function getCaretOffset() {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount || !el.contains(selection.anchorNode)) return null;

    var line = selection.anchorNode;
    while (line && line.parentNode !== el) line = line.parentNode;
    if (!line) return null;

    var offset = 0;
    for (var i = 0; i < el.children.length; i++) {
      var current = el.children[i];
      if (current === line) {
        try {
          var range = document.createRange();
          range.selectNodeContents(current);
          range.setEnd(selection.anchorNode, selection.anchorOffset);
          offset += range.toString().length;
        } catch (_) {}
        return offset;
      }
      offset += (current.textContent || '').length + 1;
    }
    return offset;
  }

  function setCaretOffset(offset) {
    if (!el) return;
    var remaining = Math.max(0, Number(offset) || 0);
    var targetLine = el.lastElementChild;
    var targetOffset = targetLine ? (targetLine.textContent || '').length : 0;

    for (var i = 0; i < el.children.length; i++) {
      var line = el.children[i];
      var length = (line.textContent || '').length;
      if (remaining <= length) {
        targetLine = line;
        targetOffset = remaining;
        break;
      }
      remaining -= length + 1;
    }

    if (!targetLine) return;
    var walker = document.createTreeWalker(targetLine, NodeFilter.SHOW_TEXT);
    var node = walker.nextNode();
    var count = targetOffset;
    while (node && count > node.nodeValue.length) {
      count -= node.nodeValue.length;
      node = walker.nextNode();
    }

    var range = document.createRange();
    if (node) range.setStart(node, Math.min(count, node.nodeValue.length));
    else range.setStart(targetLine, 0);
    range.collapse(true);

    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function getCurrentLineElement() {
    var selection = window.getSelection();
    if (!selection || !selection.rangeCount || !el.contains(selection.anchorNode)) return null;
    var line = selection.anchorNode;
    while (line && line.parentNode !== el) line = line.parentNode;
    return line && line.parentNode === el ? line : null;
  }

  function scheduleTypewriterScroll() {
    if (!window.QuietPageStorage.getSettings().typewriterScroll) return;
    if (document.activeElement !== el) return;
    clearTimeout(typewriterTimer);
    typewriterTimer = setTimeout(scrollCurrentLineIntoView, 20);
  }

  function scrollCurrentLineIntoView() {
    if (!el || document.activeElement !== el) return;
    if (!window.QuietPageStorage.getSettings().typewriterScroll) return;
    var line = getCurrentLineElement();
    var scroller = el.closest('.tab-panel');
    if (!line || !scroller) return;

    var lineRect = line.getBoundingClientRect();
    var scrollerRect = scroller.getBoundingClientRect();
    var currentLineTop = lineRect.top - scrollerRect.top + scroller.scrollTop;
    var target = currentLineTop - (scroller.clientHeight * 0.45) + (lineRect.height / 2);
    var max = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTo({
      top: Math.max(0, Math.min(max, target)),
      behavior: 'smooth',
    });
  }

  return {
    init: init,
    focus: focus,
    clear: clear,
    publish: publish,
    forceSaveDraft: forceSaveDraft,
    getText: getText,
    getHtml: getHtml,
    setText: setText,
    scrollCurrentLineIntoView: scrollCurrentLineIntoView,
  };
})();
