/* ==========================================================================
   entries.js — Recent entries list on the Write tab
   (Reuses original logic; reads from QuietPageStorage)
   ========================================================================== */

window.QuietPageEntries = (function () {
  'use strict';

  var listEl = null;
  var searchEl = null;
  var searchClearEl = null;
  var filterEl = null;
  var currentSearch = '';
  var currentFilter = 'all';
  var pendingDeleteId = null;

  function init() {
    listEl = document.getElementById('entriesList');
    searchEl = document.getElementById('searchInput');
    searchClearEl = document.getElementById('searchClear');
    filterEl = document.getElementById('filterSelect');

    if (searchEl) {
      searchEl.addEventListener('input', function () {
        currentSearch = searchEl.value;
        if (searchClearEl) {
          searchClearEl.classList.toggle('is-visible', !!searchEl.value);
        }
        render();
      });
    }
    if (searchClearEl) {
      searchClearEl.addEventListener('click', function () {
        searchEl.value = '';
        currentSearch = '';
        searchClearEl.classList.remove('is-visible');
        render();
        searchEl.focus();
      });
    }
    if (filterEl) {
      filterEl.addEventListener('change', function () {
        currentFilter = filterEl.value;
        render();
      });
    }
    document.addEventListener('click', function (e) {
      if (pendingDeleteId && !e.target.closest('.entry.is-confirming-delete')) {
        pendingDeleteId = null;
        render();
      }
    });
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
      entries = entries.filter(function (e) {
        var tags = QuietPageStorage.normalizeTags(e.tags).join(' ');
        var folder = QuietPageStorage.normalizeFolder(e.folder);
        return (e.title || '').toLowerCase().indexOf(q) !== -1 ||
               (e.text || '').toLowerCase().indexOf(q) !== -1 ||
               tags.toLowerCase().indexOf(q) !== -1 ||
               folder.toLowerCase().indexOf(q) !== -1;
      });
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

  function render() {
    updateStats();
    if (!listEl) return;
    var entries = getFiltered();

    if (entries.length === 0) {
      if (currentSearch) {
        listEl.innerHTML = '<div class="empty-state">' +
          QuietPageUtil.emptyStateHtml('search', 'Nothing found. Try different words.') +
          '</div>';
      } else {
        listEl.innerHTML = '<div class="empty-state">' +
          QuietPageUtil.emptyStateHtml('page', 'Your page is waiting. Start writing.') +
          '</div>';
      }
      return;
    }

    var html = '';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var dir = QuietPageUtil.detectDirection(e.text);
      var date = QuietPageUtil.formatEntryDate(e.createdAt);
      var words = Number.isFinite(Number(e.wordCount)) ? Number(e.wordCount) : QuietPageUtil.countWords(e.text);
      if (pendingDeleteId === e.id) {
        html += '<article class="entry is-confirming-delete" data-id="' + e.id + '">';
        html += '<div class="entry-delete-title">Delete this entry?</div>';
        html += '<div class="entry-delete-actions">';
        html += '<button type="button" data-action="confirm-remove" data-id="' + e.id + '">Delete permanently</button>';
        html += '<button type="button" data-action="cancel-remove" data-id="' + e.id + '">Cancel</button>';
        html += '</div>';
        html += '</article>';
        continue;
      }
      html += '<article class="entry' + (e.pinned ? ' is-pinned' : '') + '" data-id="' + e.id + '">';
      html += '<div class="entry-meta">';
      html += '<span class="entry-date"><strong>' + date.month + '</strong> ' + QuietPageUtil.ordinal(date.day) + ', ' + date.year + ' · ' + date.time + '</span>';
      html += '<div class="entry-side">';
      html += '<span class="entry-lang">' + QuietPageUtil.langLabel(dir) + '</span>';
      if (QuietPageStorage.getSettings().showWordCount) {
        html += '<span class="entry-words">' + words + ' words</span>';
      }
      html += '<button class="entry-action' + (e.pinned ? ' is-pinned' : '') + '" data-action="pin" data-id="' + e.id + '" aria-label="' + (e.pinned ? 'Unpin' : 'Pin') + ' entry">';
      html += '<svg viewBox="0 0 12 12"><path d="M3 1l6 6-2.5 .5L5 11l-1-3.5L1.5 7z" stroke-linejoin="round"/></svg>';
      html += (e.pinned ? 'Unpin' : 'Pin');
      html += '</button>';
      html += '<button class="entry-action" data-action="remove" data-id="' + e.id + '" aria-label="Remove entry">Remove</button>';
      html += '</div>';
      html += '</div>';
      html += '<div class="entry-body" data-action="open" data-id="' + e.id + '">' + (e.html ? QuietPageUtil.renderFormattedEntry(e.html, e.text) : QuietPageUtil.renderEntryBody(e.text)) + '</div>';
      html += '</article>';
    }
    listEl.innerHTML = html;

    // Wire actions
    var buttons = listEl.querySelectorAll('[data-action]');
    for (var j = 0; j < buttons.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var action = btn.getAttribute('data-action');
          var id = btn.getAttribute('data-id');
          if (action === 'pin') togglePin(id);
          else if (action === 'remove') remove(id);
          else if (action === 'confirm-remove') confirmRemove(id);
          else if (action === 'cancel-remove') cancelRemove();
          else if (action === 'open') openInLibrary(id);
        });
      })(buttons[j]);
    }
  }

  function openInLibrary(id) {
    // Switch to Library tab and select the entry
    document.dispatchEvent(new CustomEvent('quiet:open-in-library', { detail: { id: id } }));
  }

  function updateStats() {
    var entries = QuietPageStorage.getEntries();
    var totalWords = 0;
    for (var i = 0; i < entries.length; i++) {
      totalWords += Number.isFinite(Number(entries[i].wordCount))
        ? Number(entries[i].wordCount)
        : QuietPageUtil.countWords(entries[i].text || entries[i].content || '');
    }
    var streak = QuietPageUtil.calculateStreak(entries);

    var statEntries = document.getElementById('statEntries');
    var statWords = document.getElementById('statWords');
    var statStreak = document.getElementById('statStreak');
    if (statEntries) statEntries.textContent = entries.length;
    if (statWords) statWords.textContent = totalWords;
    if (statStreak) statStreak.textContent = streak;
  }

  function togglePin(id) {
    var entries = QuietPageStorage.getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) {
        entries[i].pinned = !entries[i].pinned;
        QuietPageStorage.setEntries(entries);
        document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'pin', id: id } }));
        QuietPageUtil.toast(entries[i].pinned ? 'Pinned' : 'Unpinned');
        break;
      }
    }
  }

  function remove(id) {
    pendingDeleteId = id;
    render();
  }

  function cancelRemove() {
    pendingDeleteId = null;
    render();
  }

  function confirmRemove(id) {
    var entries = QuietPageStorage.getEntries();
    var filtered = entries.filter(function (e) { return e.id !== id; });
    if (filtered.length === entries.length) return;
    QuietPageStorage.setEntries(filtered);
    pendingDeleteId = null;
    document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'remove', id: id } }));
    QuietPageUtil.toast('Removed');
  }

  return {
    init: init,
    render: render,
    updateStats: updateStats,
    getFiltered: getFiltered,
  };
})();
