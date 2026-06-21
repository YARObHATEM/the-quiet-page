/* ==========================================================================
   library.js — Library tab: sidebar of memories + reader pane
   ========================================================================== */

window.QuietPageLibrary = (function () {
  'use strict';

  var listEl = null;
  var searchEl = null;
  var filterBtns = null;
  var readerEmpty = null;
  var readerContent = null;
  var readerDate = null;
  var readerLang = null;
  var readerWords = null;
  var readerBody = null;
  var pinBtn = null;
  var copyBtn = null;
  var exportBtn = null;
  var removeBtn = null;
  var editBtn = null;
  var editorEl = null;
  var editorTextarea = null;
  var editorSaveBtn = null;
  var editorCancelBtn = null;
  var readerActionsEl = null;

  var currentSearch = '';
  var currentFilter = 'all';
  var currentId = null;
  var isEditing = false;

  function init() {
    listEl = document.getElementById('libraryList');
    searchEl = document.getElementById('librarySearch');
    filterBtns = document.querySelectorAll('.lib-filter');
    readerEmpty = document.getElementById('readerEmpty');
    readerContent = document.getElementById('readerContent');
    readerDate = document.getElementById('readerDate');
    readerLang = document.getElementById('readerLang');
    readerWords = document.getElementById('readerWords');
    readerBody = document.getElementById('readerBody');
    pinBtn = document.getElementById('readerPin');
    copyBtn = document.getElementById('readerCopy');
    exportBtn = document.getElementById('readerExport');
    removeBtn = document.getElementById('readerRemove');
    editBtn = document.getElementById('readerEdit');
    editorEl = document.getElementById('readerEditor');
    editorTextarea = document.getElementById('readerEditorTextarea');
    editorSaveBtn = document.getElementById('readerEditSave');
    editorCancelBtn = document.getElementById('readerEditCancel');
    readerActionsEl = document.getElementById('readerActions');

    if (searchEl) {
      searchEl.addEventListener('input', function () {
        currentSearch = searchEl.value;
        renderList();
      });
    }

    if (filterBtns) {
      for (var i = 0; i < filterBtns.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            for (var j = 0; j < filterBtns.length; j++) filterBtns[j].classList.remove('is-active');
            btn.classList.add('is-active');
            currentFilter = btn.getAttribute('data-filter');
            renderList();
          });
        })(filterBtns[i]);
      }
    }

    if (editBtn) editBtn.addEventListener('click', function () { if (currentId) enterEditMode(); });
    if (editorSaveBtn) editorSaveBtn.addEventListener('click', saveEdit);
    if (editorCancelBtn) editorCancelBtn.addEventListener('click', cancelEdit);
    if (editorTextarea) {
      editorTextarea.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          saveEdit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelEdit();
        }
      });
    }
    if (pinBtn) pinBtn.addEventListener('click', function () { if (currentId && !isEditing) togglePin(currentId); });
    if (copyBtn) copyBtn.addEventListener('click', function () { if (currentId && !isEditing) copyCurrent(); });
    if (exportBtn) exportBtn.addEventListener('click', function () { if (currentId && !isEditing) exportCurrent(); });
    if (removeBtn) removeBtn.addEventListener('click', function () { if (currentId && !isEditing) removeCurrent(); });
  }

  /* ---------- Edit mode ---------- */

  function enterEditMode() {
    if (!currentId) return;
    var entry = findEntry(currentId);
    if (!entry) return;
    isEditing = true;
    editorTextarea.value = entry.text;
    var dir = QuietPageUtil.detectDirection(entry.text);
    editorTextarea.dir = dir;
    readerBody.hidden = true;
    editorEl.hidden = false;
    // Hide the action bar while editing (except via Save/Cancel)
    if (readerActionsEl) readerActionsEl.style.display = 'none';
    setTimeout(function () {
      editorTextarea.focus();
      var len = editorTextarea.value.length;
      editorTextarea.setSelectionRange(len, len);
      autoResizeEditor();
    }, 30);
  }

  function autoResizeEditor() {
    if (!editorTextarea) return;
    editorTextarea.style.height = 'auto';
    var h = Math.max(editorTextarea.scrollHeight, 280);
    editorTextarea.style.height = h + 'px';
  }

  function cancelEdit() {
    isEditing = false;
    readerBody.hidden = false;
    editorEl.hidden = true;
    if (readerActionsEl) readerActionsEl.style.display = '';
  }

  function saveEdit() {
    if (!currentId) return;
    var newText = editorTextarea.value.trim();
    if (!newText) {
      QuietPageUtil.toast('Cannot save empty entry', 'error');
      return;
    }
    var entries = QuietPageStorage.getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === currentId) {
        entries[i].text = newText;
        entries[i].updatedAt = new Date().toISOString();
        break;
      }
    }
    QuietPageStorage.setEntries(entries);
    document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'edit', id: currentId } }));
    QuietPageUtil.toast('Saved');
    cancelEdit();
    select(currentId); // re-render with new content
  }

  function getFiltered() {
    var entries = QuietPageStorage.getEntries().slice();
    if (currentFilter === 'en') {
      entries = entries.filter(function (e) { return QuietPageUtil.detectDirection(e.text) === 'ltr'; });
    } else if (currentFilter === 'ar') {
      entries = entries.filter(function (e) { return QuietPageUtil.detectDirection(e.text) === 'rtl'; });
    } else if (currentFilter === 'pinned') {
      entries = entries.filter(function (e) { return e.pinned; });
    }
    if (currentSearch) {
      var q = currentSearch.toLowerCase();
      entries = entries.filter(function (e) { return e.text.toLowerCase().indexOf(q) !== -1; });
    }
    entries.sort(function (a, b) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return entries;
  }

  function renderList() {
    if (!listEl) return;
    var entries = getFiltered();

    if (entries.length === 0) {
      listEl.innerHTML = '<div style="padding:2rem 1rem;text-align:center;font-family:Cormorant Garamond,serif;font-style:italic;color:var(--text-muted);font-size:0.95rem;">' +
                         (currentSearch ? 'No matches.' : 'No memories yet.') + '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var date = QuietPageUtil.formatEntryDate(e.createdAt);
      var dir = QuietPageUtil.detectDirection(e.text);
      var preview = QuietPageUtil.previewText(e.text, 140);
      var words = QuietPageUtil.countWords(e.text);
      html += '<div class="lib-card' +
              (e.id === currentId ? ' is-active' : '') +
              (e.pinned ? ' is-pinned' : '') +
              '" data-id="' + e.id + '">';
      html += '<div class="lib-card-date">' + date.monthShort + ' ' + QuietPageUtil.ordinal(date.day) + ', ' + date.year + ' · ' + date.time + '</div>';
      html += '<div class="lib-card-preview" dir="' + dir + '">' + QuietPageUtil.escapeHtml(preview) + '</div>';
      html += '<div class="lib-card-meta"><span>' + QuietPageUtil.langLabel(dir) + '</span><span>' + words + 'w</span></div>';
      html += '</div>';
    }
    listEl.innerHTML = html;

    var cards = listEl.querySelectorAll('.lib-card');
    for (var j = 0; j < cards.length; j++) {
      (function (card) {
        card.addEventListener('click', function () {
          select(card.getAttribute('data-id'));
        });
      })(cards[j]);
    }
  }

  function select(id) {
    var entries = QuietPageStorage.getEntries();
    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) { entry = entries[i]; break; }
    }
    if (!entry) return;

    // If we're switching to a different entry, exit edit mode first
    if (currentId !== id && isEditing) {
      cancelEdit();
    }

    currentId = id;

    if (readerEmpty) readerEmpty.hidden = true;
    if (readerContent) readerContent.hidden = false;
    // Always make sure reader body is visible and editor is hidden on fresh select
    if (readerBody) readerBody.hidden = false;
    if (editorEl) editorEl.hidden = true;
    if (readerActionsEl) readerActionsEl.style.display = '';
    isEditing = false;

    var date = QuietPageUtil.formatEntryDate(entry.createdAt);
    var dir = QuietPageUtil.detectDirection(entry.text);
    var words = QuietPageUtil.countWords(entry.text);

    if (readerDate) readerDate.innerHTML = '<strong>' + date.month + '</strong> ' + QuietPageUtil.ordinal(date.day) + ', ' + date.year + ' · ' + date.time;
    if (readerLang) readerLang.textContent = QuietPageUtil.langLabel(dir);
    if (readerWords) readerWords.textContent = words + ' words';
    if (readerBody) readerBody.innerHTML = QuietPageUtil.renderEntryBody(entry.text);
    if (pinBtn) pinBtn.textContent = entry.pinned ? 'Unpin' : 'Pin';

    renderList(); // update active styling
  }

  function togglePin(id) {
    var entries = QuietPageStorage.getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) {
        entries[i].pinned = !entries[i].pinned;
        QuietPageStorage.setEntries(entries);
        document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'pin', id: id } }));
        if (pinBtn) pinBtn.textContent = entries[i].pinned ? 'Unpin' : 'Pin';
        renderList();
        break;
      }
    }
  }

  function copyCurrent() {
    var entry = findEntry(currentId);
    if (!entry) return;
    navigator.clipboard.writeText(entry.text).then(function () {
      QuietPageUtil.toast('Copied');
    }).catch(function () {
      QuietPageUtil.toast('Could not copy', 'error');
    });
  }

  function exportCurrent() {
    var entry = findEntry(currentId);
    if (!entry) return;
    var date = QuietPageUtil.formatEntryDate(entry.createdAt);
    var filename = 'quiet-page-' + date.iso + '.txt';
    var content = 'THE QUIET PAGE\n' +
                  date.month + ' ' + QuietPageUtil.ordinal(date.day) + ', ' + date.year + ' — ' + date.time + '\n' +
                  new Array(40).join('─') + '\n\n' +
                  entry.text + '\n';
    window.QuietPage.dialog.saveExport({
      defaultName: filename,
      filters: [{ name: 'Text', extensions: ['txt'] }],
      content: content,
    }).then(function (res) {
      if (!res.canceled) QuietPageUtil.toast('Exported');
    });
  }

  function removeCurrent() {
    if (!currentId) return;
    var doRemove = function () {
      var entries = QuietPageStorage.getEntries();
      var filtered = entries.filter(function (e) { return e.id !== currentId; });
      QuietPageStorage.setEntries(filtered);
      currentId = null;
      if (readerEmpty) readerEmpty.hidden = false;
      if (readerContent) readerContent.hidden = true;
      document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'remove' } }));
      QuietPageUtil.toast('Removed');
      renderList();
    };
    if (QuietPageStorage.getSettings().confirmDelete) {
      window.QuietPage.dialog.confirm({
        title: 'Remove entry?',
        message: 'This cannot be undone.',
        okLabel: 'Remove',
        cancelLabel: 'Cancel',
      }).then(function (ok) { if (ok) doRemove(); });
    } else {
      doRemove();
    }
  }

  function findEntry(id) {
    var entries = QuietPageStorage.getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) return entries[i];
    }
    return null;
  }

  function refresh() {
    renderList();
    if (currentId && !findEntry(currentId)) {
      currentId = null;
      if (readerEmpty) readerEmpty.hidden = false;
      if (readerContent) readerContent.hidden = true;
    } else if (currentId) {
      select(currentId);
    }
  }

  function openEntry(id) {
    select(id);
  }

  return {
    init: init,
    renderList: renderList,
    refresh: refresh,
    openEntry: openEntry,
  };
})();
