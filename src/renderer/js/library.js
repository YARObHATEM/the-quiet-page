/* ==========================================================================
   library.js — Library tab: sidebar of memories + reader pane
   ========================================================================== */

window.QuietPageLibrary = (function () {
  'use strict';

  var listEl = null;
  var searchEl = null;
  var filterBtns = null;
  var folderFilterListEl = null;
  var tagFilterListEl = null;
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
  var readerFolderInput = null;
  var readerFolderSave = null;
  var readerTagInput = null;
  var readerTagList = null;
  var folderMenuEl = null;
  var editOverlay = null;
  var editOverlayTitle = null;
  var editOverlayTextarea = null;
  var editOverlaySaveBtn = null;
  var editOverlayCancelBtn = null;
  var editOverlayCloseBtn = null;
  var editReturnFocus = null;

  var currentSearch = '';
  var currentFilter = 'all';
  var currentFolder = 'all';
  var selectedTags = [];
  var currentId = null;
  var isEditing = false;
  var currentReaderTags = [];
  var pendingDeleteId = null;

  function init() {
    listEl = document.getElementById('libraryList');
    searchEl = document.getElementById('librarySearch');
    filterBtns = document.querySelectorAll('.lib-filter');
    folderFilterListEl = document.getElementById('folderFilterList');
    tagFilterListEl = document.getElementById('tagFilterList');
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
    readerFolderInput = document.getElementById('readerFolderInput');
    readerFolderSave = document.getElementById('readerFolderSave');
    readerTagInput = document.getElementById('readerTagInput');
    readerTagList = document.getElementById('readerTagList');
    editOverlay = document.getElementById('entryEditOverlay');
    editOverlayTitle = document.getElementById('entryEditTitle');
    editOverlayTextarea = document.getElementById('entryEditTextarea');
    editOverlaySaveBtn = document.getElementById('entryEditSave');
    editOverlayCancelBtn = document.getElementById('entryEditCancel');
    editOverlayCloseBtn = document.getElementById('entryEditClose');

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
    if (editOverlaySaveBtn) editOverlaySaveBtn.addEventListener('click', saveEdit);
    if (editOverlayCancelBtn) editOverlayCancelBtn.addEventListener('click', cancelEdit);
    if (editOverlayCloseBtn) editOverlayCloseBtn.addEventListener('click', cancelEdit);
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
    if (editOverlayTextarea) {
      editOverlayTextarea.addEventListener('input', autoResizeEditor);
      editOverlayTextarea.addEventListener('keydown', function (e) {
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
    if (removeBtn) removeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (currentId && !isEditing) removeCurrent();
    });
    if (readerFolderInput) {
      readerFolderInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveReaderFolder();
        }
      });
    }
    if (readerFolderSave) readerFolderSave.addEventListener('click', saveReaderFolder);
    if (readerTagInput) {
      readerTagInput.addEventListener('keydown', onReaderTagKeydown);
      readerTagInput.addEventListener('input', onReaderTagChanged);
    }
    createFolderMenu();
    document.addEventListener('click', function (e) {
      closeFolderMenu();
      if (pendingDeleteId && !e.target.closest('.lib-card.is-confirming-delete')) {
        pendingDeleteId = null;
        renderList();
      }
    });
    document.addEventListener('quiet:draft-changed', renderList);
  }

  /* ---------- Edit mode ---------- */

  function enterEditMode() {
    if (!currentId) return;
    var entry = findEntry(currentId);
    if (!entry) return;
    isEditing = true;
    if (editOverlay && editOverlayTextarea) {
      editReturnFocus = document.activeElement;
      if (editOverlayTitle) editOverlayTitle.textContent = entry.title || 'Edit entry';
      editOverlayTextarea.value = entry.text;
      editOverlayTextarea.dir = QuietPageUtil.detectDirection(entry.text);
      editOverlay.hidden = false;
      document.body.classList.add('entry-edit-open');
      setTimeout(function () {
        editOverlayTextarea.focus();
        var length = editOverlayTextarea.value.length;
        editOverlayTextarea.setSelectionRange(length, length);
        autoResizeEditor();
      }, 30);
      return;
    }

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
    var textarea = activeEditorTextarea();
    if (!textarea) return;
    textarea.style.height = 'auto';
    var h = Math.max(textarea.scrollHeight, 280);
    textarea.style.height = h + 'px';
  }

  function cancelEdit() {
    isEditing = false;
    if (readerBody) readerBody.hidden = false;
    if (editorEl) editorEl.hidden = true;
    if (readerActionsEl) readerActionsEl.style.display = '';
    if (editOverlay) editOverlay.hidden = true;
    document.body.classList.remove('entry-edit-open');
    if (editReturnFocus && typeof editReturnFocus.focus === 'function') {
      setTimeout(function () { editReturnFocus.focus(); }, 0);
    }
    editReturnFocus = null;
  }

  function saveEdit() {
    if (!currentId) return;
    var textarea = activeEditorTextarea();
    var newText = textarea ? textarea.value.trim() : '';
    if (!newText) {
      QuietPageUtil.toast('Cannot save empty entry', 'error');
      return;
    }
    var entries = QuietPageStorage.getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === currentId) {
        entries[i].text = newText;
        delete entries[i].html;
        entries[i].updatedAt = new Date().toISOString();
        entries[i] = QuietPageStorage.normalizeEntry(entries[i]);
        break;
      }
    }
    QuietPageStorage.setEntries(entries);
    document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'edit', id: currentId } }));
    QuietPageUtil.toast('Saved');
    cancelEdit();
    select(currentId); // re-render with new content
  }

  function activeEditorTextarea() {
    if (editOverlay && !editOverlay.hidden && editOverlayTextarea) return editOverlayTextarea;
    return editorTextarea;
  }

  function renderTaxonomy() {
    renderFolders();
    renderTagFilters();
  }

  function getFolders(entries) {
    var counts = {};
    for (var i = 0; i < entries.length; i++) {
      var folder = QuietPageStorage.normalizeFolder(entries[i].folder);
      counts[folder] = (counts[folder] || 0) + 1;
    }
    var folders = Object.keys(counts).sort(function (a, b) {
      if (a === 'Uncategorized') return -1;
      if (b === 'Uncategorized') return 1;
      return a.localeCompare(b);
    });
    return folders.map(function (name) { return { name: name, count: counts[name] }; });
  }

  function renderFolders() {
    if (!folderFilterListEl) return;
    var entries = QuietPageStorage.getEntries();
    var folders = getFolders(entries);
    var folderExists = currentFolder === 'all';
    for (var f = 0; f < folders.length; f++) {
      if (folders[f].name === currentFolder) {
        folderExists = true;
        break;
      }
    }
    if (!folderExists) currentFolder = 'all';
    var html = '<button class="folder-filter' + (currentFolder === 'all' ? ' is-active' : '') + '" type="button" data-folder="all">All Entries <span>' + entries.length + '</span></button>';
    for (var i = 0; i < folders.length; i++) {
      var folder = folders[i].name;
      html += '<button class="folder-filter' + (currentFolder === folder ? ' is-active' : '') + '" type="button" data-folder="' + QuietPageUtil.escapeHtml(folder) + '">' +
              '<span>' + QuietPageUtil.escapeHtml(folder) + '</span><span>' + folders[i].count + '</span>';
      if (folder !== 'Uncategorized') {
        html += '<span class="folder-menu-btn" role="button" tabindex="0" data-folder-menu="' + QuietPageUtil.escapeHtml(folder) + '" aria-label="Folder options">⋯</span>';
      }
      html += '</button>';
    }
    folderFilterListEl.innerHTML = html;

    var folderBtns = folderFilterListEl.querySelectorAll('.folder-filter');
    for (var j = 0; j < folderBtns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function (e) {
          var menu = e.target.closest('[data-folder-menu]');
          if (menu) {
            e.stopPropagation();
            openFolderMenu(menu.getAttribute('data-folder-menu'));
            return;
          }
          currentFolder = btn.getAttribute('data-folder');
          renderList();
        });
        btn.addEventListener('contextmenu', function (e) {
          var folder = btn.getAttribute('data-folder');
          if (folder === 'all' || folder === 'Uncategorized') return;
          e.preventDefault();
          openFolderMenu(folder);
        });
      })(folderBtns[j]);
    }
  }

  function renderTagFilters() {
    return;
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
    if (currentFolder !== 'all') {
      entries = entries.filter(function (e) {
        return QuietPageStorage.normalizeFolder(e.folder) === currentFolder;
      });
    }
    if (selectedTags.length) {
      entries = entries.filter(function (e) {
        var tags = QuietPageStorage.normalizeTags(e.tags);
        for (var i = 0; i < selectedTags.length; i++) {
          if (tags.indexOf(selectedTags[i]) === -1) return false;
        }
        return true;
      });
    }
    if (currentSearch) {
      var q = currentSearch.toLowerCase();
      entries = entries.filter(function (e) { return entryMatchesSearch(e, q); });
    }
    entries.sort(function (a, b) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return entryTime(b) - entryTime(a);
    });
    return entries;
  }

  function entryTime(entry) {
    var time = Date.parse(entry.updatedAt || entry.createdAt);
    return Number.isFinite(time) ? time : 0;
  }

  function entryMatchesSearch(entry, q) {
    var tags = QuietPageStorage.normalizeTags(entry.tags).join(' ');
    var folder = QuietPageStorage.normalizeFolder(entry.folder);
    return (entry.title || '').toLowerCase().indexOf(q) !== -1 ||
           (entry.text || '').toLowerCase().indexOf(q) !== -1 ||
           tags.toLowerCase().indexOf(q) !== -1 ||
           folder.toLowerCase().indexOf(q) !== -1;
  }

  function renderList() {
    if (!listEl) return;
    renderTaxonomy();
    var entries = getFiltered();
    var draftText = getDraftText();
    var hasDraft = !!draftText.trim();

    if (entries.length === 0 && !hasDraft) {
      var message = currentSearch
        ? 'Nothing found. Try different words.'
        : 'Your page is waiting. Start writing.';
      listEl.innerHTML = '<div class="library-empty-state">' + QuietPageUtil.emptyStateHtml(currentSearch ? 'search' : 'page', message) + '</div>';
      return;
    }

    var html = '';
    if (hasDraft) html += renderDraftCard(draftText);
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var date = QuietPageUtil.formatEntryDate(e.createdAt);
      var title = window.truncateTitle(e.title || '', 120);
      var preview = QuietPageUtil.previewText(e.body || '', 100);
      var dir = QuietPageUtil.detectDirection(e.title || e.body || e.text);
      var words = Number.isFinite(Number(e.wordCount)) ? Number(e.wordCount) : QuietPageUtil.countWords(e.text);
      var tags = QuietPageStorage.normalizeTags(e.tags);
      var folder = QuietPageStorage.normalizeFolder(e.folder);
      if (pendingDeleteId === e.id) {
        html += '<div class="lib-card is-confirming-delete" data-id="' + e.id + '">';
        html += '<div class="lib-card-title">Delete this entry?</div>';
        html += '<div class="lib-delete-actions">';
        html += '<button type="button" class="lib-delete-confirm" data-delete-confirm="' + e.id + '">Delete permanently</button>';
        html += '<button type="button" class="lib-delete-cancel" data-delete-cancel>Cancel</button>';
        html += '</div>';
        html += '</div>';
        continue;
      }
      html += '<div class="lib-card' +
              (e.id === currentId ? ' is-active' : '') +
              (e.pinned ? ' is-pinned' : '') +
              '" data-id="' + e.id + '">';
      if (title) {
        html += '<div class="lib-card-title" dir="' + dir + '">' + QuietPageUtil.escapeHtml(title) + '</div>';
      }
      html += '<div class="lib-card-date">' + date.monthShort + ' ' + QuietPageUtil.ordinal(date.day) + ', ' + date.year + ' · ' + date.time + '</div>';
      html += '<div class="lib-card-meta"><span>' + QuietPageUtil.escapeHtml(folder) + '</span><span>' + QuietPageUtil.langLabel(dir) + '</span><span>' + words + ' words</span></div>';
      html += '</div>';
    }
    listEl.innerHTML = html;

    var draftCard = listEl.querySelector('[data-draft-card]');
    if (draftCard) {
      draftCard.addEventListener('click', openDraftInComposer);
    }

    var confirmBtns = listEl.querySelectorAll('[data-delete-confirm]');
    for (var c = 0; c < confirmBtns.length; c++) {
      (function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          removeEntry(btn.getAttribute('data-delete-confirm'));
        });
      })(confirmBtns[c]);
    }
    var cancelBtns = listEl.querySelectorAll('[data-delete-cancel]');
    for (var x = 0; x < cancelBtns.length; x++) {
      cancelBtns[x].addEventListener('click', function (ev) {
        ev.stopPropagation();
        pendingDeleteId = null;
        renderList();
      });
    }

    var cards = listEl.querySelectorAll('.lib-card[data-id]:not(.is-confirming-delete)');
    for (var j = 0; j < cards.length; j++) {
      (function (card) {
        card.addEventListener('click', function () {
          var id = card.getAttribute('data-id');
          select(id);
        });
      })(cards[j]);
    }
  }

  function renderDraftCard(text) {
    var dir = QuietPageUtil.detectDirection(text);
    var preview = QuietPageUtil.previewText(text, 100);
    var words = QuietPageUtil.countWords(text);
    var title = 'Draft in progress';
    var html = '<div class="lib-card lib-draft-card" data-draft-card>';
    html += '<div class="lib-card-title" dir="' + dir + '">' + QuietPageUtil.escapeHtml(title) + '</div>';
    html += '<div class="lib-card-date">Continue current draft</div>';
    html += '<div class="lib-card-meta"><span>Draft</span><span>' + words + ' words</span></div>';
    html += '</div>';
    return html;
  }

  function getDraftText() {
    if (!window.QuietPageComposer || !window.QuietPageComposer.getText) return '';
    return window.QuietPageComposer.getText() || '';
  }

  function openDraftInComposer() {
    if (window.QuietPageTabs) window.QuietPageTabs.switchTo('write');
    setTimeout(function () {
      if (window.QuietPageComposer && window.QuietPageComposer.focus) {
        window.QuietPageComposer.focus();
      }
    }, 80);
  }

  function renderTagsPreview(tags) {
    var html = '<div class="lib-card-tags">';
    var limit = Math.min(3, tags.length);
    for (var i = 0; i < limit; i++) {
      html += '<span class="tag-chip">' + QuietPageUtil.escapeHtml(tags[i]) + '</span>';
    }
    if (tags.length > 3) html += '<span class="tag-chip">+' + (tags.length - 3) + '</span>';
    html += '</div>';
    return html;
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
    var words = Number.isFinite(Number(entry.wordCount)) ? Number(entry.wordCount) : QuietPageUtil.countWords(entry.text);

    if (readerDate) readerDate.innerHTML = '<strong>' + date.month + '</strong> ' + QuietPageUtil.ordinal(date.day) + ', ' + date.year + ' · ' + date.time;
    if (readerLang) readerLang.textContent = QuietPageUtil.langLabel(dir);
    if (readerWords) readerWords.textContent = words + ' words';
    if (readerBody) readerBody.innerHTML = entry.html
      ? QuietPageUtil.renderFormattedEntry(entry.html, entry.text)
      : QuietPageUtil.renderEntryBody(entry.text);
    if (pinBtn) pinBtn.textContent = entry.pinned ? 'Unpin' : 'Pin';
    if (readerFolderInput) readerFolderInput.value = QuietPageStorage.normalizeFolder(entry.folder);
    currentReaderTags = QuietPageStorage.normalizeTags(entry.tags);
    renderReaderTags();

    renderList(); // update active styling
  }

  function saveReaderFolder() {
    if (!currentId || !readerFolderInput) return;
    updateCurrentEntryMeta({
      folder: QuietPageStorage.normalizeFolder(readerFolderInput.value),
    });
    QuietPageUtil.toast('Folder saved');
  }

  function onReaderTagKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addReaderTag(readerTagInput.value);
    } else if (e.key === 'Backspace' && !readerTagInput.value && currentReaderTags.length) {
      currentReaderTags.pop();
      saveReaderTags();
    }
  }

  function onReaderTagChanged() {
    if (!readerTagInput || readerTagInput.value.indexOf(',') === -1) return;
    var parts = readerTagInput.value.split(',');
    for (var i = 0; i < parts.length - 1; i++) addReaderTag(parts[i], true);
    readerTagInput.value = parts[parts.length - 1];
    saveReaderTags();
  }

  function addReaderTag(value, keepInput) {
    currentReaderTags = QuietPageStorage.normalizeTags(currentReaderTags.concat([value]));
    if (!keepInput && readerTagInput) readerTagInput.value = '';
    saveReaderTags();
  }

  function removeReaderTag(tag) {
    currentReaderTags = currentReaderTags.filter(function (t) { return t !== tag; });
    saveReaderTags();
  }

  function saveReaderTags() {
    updateCurrentEntryMeta({ tags: currentReaderTags });
  }

  function renderReaderTags() {
    if (!readerTagList) return;
    var html = '';
    for (var i = 0; i < currentReaderTags.length; i++) {
      html += '<span class="tag-chip">' + QuietPageUtil.escapeHtml(currentReaderTags[i]) +
              '<button class="tag-chip-remove" type="button" data-tag="' + QuietPageUtil.escapeHtml(currentReaderTags[i]) + '" aria-label="Remove tag">×</button></span>';
    }
    readerTagList.innerHTML = html;
    var removeBtns = readerTagList.querySelectorAll('.tag-chip-remove');
    for (var j = 0; j < removeBtns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () { removeReaderTag(btn.getAttribute('data-tag')); });
      })(removeBtns[j]);
    }
  }

  function updateCurrentEntryMeta(patch) {
    if (!currentId) return;
    var entries = QuietPageStorage.getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === currentId) {
        if (patch.folder !== undefined) entries[i].folder = patch.folder;
        if (patch.tags !== undefined) entries[i].tags = QuietPageStorage.normalizeTags(patch.tags);
        entries[i].updatedAt = new Date().toISOString();
        entries[i] = QuietPageStorage.normalizeEntry(entries[i]);
        if (readerFolderInput && patch.folder !== undefined) readerFolderInput.value = entries[i].folder;
        currentReaderTags = QuietPageStorage.normalizeTags(entries[i].tags);
        renderReaderTags();
        QuietPageStorage.setEntries(entries);
        document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'organize', id: currentId } }));
        renderList();
        break;
      }
    }
  }

  function openFolderMenu(folder) {
    if (!folder || folder === 'all' || folder === 'Uncategorized') return;
    if (!folderMenuEl) createFolderMenu();
    folderMenuEl.dataset.folder = folder;
    folderMenuEl.hidden = false;
    var button = findFolderMenuButton(folder);
    var rect = button ? button.getBoundingClientRect() : null;
    if (rect) {
      folderMenuEl.style.left = Math.round(rect.left) + 'px';
      folderMenuEl.style.top = Math.round(rect.bottom + 6) + 'px';
    }
  }

  function closeFolderMenu() {
    if (folderMenuEl) {
      folderMenuEl.hidden = true;
      renderFolderMenuActions();
    }
  }

  function createFolderMenu() {
    if (folderMenuEl) return;
    folderMenuEl = document.createElement('div');
    folderMenuEl.className = 'folder-action-menu';
    folderMenuEl.hidden = true;
    renderFolderMenuActions();
    folderMenuEl.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target.closest('[data-folder-rename-save]')) {
        commitFolderRename(folderMenuEl.dataset.folder, folderMenuEl.querySelector('[data-folder-rename-input]').value);
        return;
      }
      if (e.target.closest('[data-folder-rename-cancel]')) {
        closeFolderMenu();
        return;
      }
      var actionButton = e.target.closest('[data-folder-action]');
      if (!actionButton) return;
      var folder = folderMenuEl.dataset.folder;
      if (actionButton.getAttribute('data-folder-action') === 'rename') {
        showRenameFolderForm(folder);
      } else {
        closeFolderMenu();
        deleteFolder(folder);
      }
    });
    folderMenuEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFolderMenu();
      } else if (e.key === 'Enter' && e.target.closest('[data-folder-rename-input]')) {
        e.preventDefault();
        commitFolderRename(folderMenuEl.dataset.folder, e.target.value);
      }
    });
    document.body.appendChild(folderMenuEl);
  }

  function renderFolderMenuActions() {
    if (!folderMenuEl) return;
    folderMenuEl.innerHTML = '<button type="button" data-folder-action="rename">Rename</button><button type="button" data-folder-action="delete">Delete</button>';
  }

  function showRenameFolderForm(folder) {
    if (!folderMenuEl) return;
    folderMenuEl.innerHTML = '<div class="folder-rename-form">' +
      '<input type="text" data-folder-rename-input maxlength="48" value="' + QuietPageUtil.escapeHtml(folder) + '" aria-label="Rename folder">' +
      '<div class="folder-rename-actions">' +
        '<button type="button" data-folder-rename-save>Save</button>' +
        '<button type="button" data-folder-rename-cancel>Cancel</button>' +
      '</div>' +
    '</div>';
    setTimeout(function () {
      var input = folderMenuEl.querySelector('[data-folder-rename-input]');
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  function findFolderMenuButton(folder) {
    if (!folderFilterListEl) return null;
    var buttons = folderFilterListEl.querySelectorAll('[data-folder-menu]');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute('data-folder-menu') === folder) return buttons[i];
    }
    return null;
  }

  function commitFolderRename(oldName, next) {
    next = QuietPageStorage.normalizeFolder(next);
    if (!next || next === oldName) {
      closeFolderMenu();
      return;
    }
    var entries = QuietPageStorage.getEntries();
    var changed = false;
    for (var i = 0; i < entries.length; i++) {
      if (QuietPageStorage.normalizeFolder(entries[i].folder) === oldName) {
        entries[i].folder = next;
        entries[i].updatedAt = new Date().toISOString();
        entries[i] = QuietPageStorage.normalizeEntry(entries[i]);
        changed = true;
      }
    }
    if (!changed) return;
    if (currentFolder === oldName) currentFolder = next;
    QuietPageStorage.setEntries(entries);
    document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'folder-rename', from: oldName, to: next } }));
    QuietPageUtil.toast('Folder renamed');
    closeFolderMenu();
    if (currentId) select(currentId);
    else renderList();
  }

  function deleteFolder(folder) {
    window.QuietPage.dialog.confirm({
      title: 'Delete folder?',
      message: 'Move entries in "' + folder + '" back to Uncategorized? The entries will not be deleted.',
      okLabel: 'Delete Folder',
      cancelLabel: 'Cancel',
    }).then(function (ok) {
      if (!ok) return;
      var entries = QuietPageStorage.getEntries();
      var changed = false;
      for (var i = 0; i < entries.length; i++) {
        if (QuietPageStorage.normalizeFolder(entries[i].folder) === folder) {
          entries[i].folder = 'Uncategorized';
          entries[i].updatedAt = new Date().toISOString();
          entries[i] = QuietPageStorage.normalizeEntry(entries[i]);
          changed = true;
        }
      }
      if (!changed) return;
      if (currentFolder === folder) currentFolder = 'all';
      QuietPageStorage.setEntries(entries);
      document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'folder-delete', folder: folder } }));
      QuietPageUtil.toast('Folder removed');
      if (currentId) select(currentId);
      else renderList();
    });
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
    var parts = [];
    parts.push('Folder: ' + QuietPageStorage.normalizeFolder(entry.folder));
    var tags = QuietPageStorage.normalizeTags(entry.tags);
    if (tags.length) parts.push('Tags: ' + tags.join(', '));
    if (entry.title) parts.push(entry.title);
    if (entry.body) parts.push(entry.body);
    var content = parts.join('\n\n');
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
    pendingDeleteId = currentId;
    renderList();
    setTimeout(function () {
      var card = listEl && listEl.querySelector('.lib-card.is-confirming-delete');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  function removeEntry(id) {
    if (!id) return;
    var entries = QuietPageStorage.getEntries();
    var filtered = entries.filter(function (e) { return e.id !== id; });
    if (filtered.length === entries.length) return;
    QuietPageStorage.setEntries(filtered);
    if (currentId === id) {
      currentId = null;
      if (readerEmpty) readerEmpty.hidden = false;
      if (readerContent) readerContent.hidden = true;
    }
    pendingDeleteId = null;
    document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'remove', id: id } }));
    QuietPageUtil.toast('Removed');
    renderList();
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
    saveCurrentEdit: function () { if (isEditing) saveEdit(); },
  };
})();
