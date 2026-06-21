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
        return e.text.toLowerCase().indexOf(q) !== -1;
      });
    }
    entries.sort(function (a, b) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return entries;
  }

  function render() {
    if (!listEl) return;
    var entries = getFiltered();
    updateStats();

    if (entries.length === 0) {
      if (currentSearch) {
        listEl.innerHTML = '<div class="empty-state">No entries match your search.<span>Try different words.</span></div>';
      } else {
        listEl.innerHTML = '<div class="empty-state">Nothing written yet.<span>The page awaits.</span></div>';
      }
      return;
    }

    var html = '';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var dir = QuietPageUtil.detectDirection(e.text);
      var date = QuietPageUtil.formatEntryDate(e.createdAt);
      var words = QuietPageUtil.countWords(e.text);
      html += '<article class="entry' + (e.pinned ? ' is-pinned' : '') + '" data-id="' + e.id + '">';
      html += '<div class="entry-meta">';
      html += '<span class="entry-date"><strong>' + date.month + '</strong> ' + QuietPageUtil.ordinal(date.day) + ', ' + date.year + ' · ' + date.time + '</span>';
      html += '<div class="entry-side">';
      html += '<span class="entry-lang">' + QuietPageUtil.langLabel(dir) + '</span>';
      if (QuietPageStorage.getSettings().showWordCount) {
        html += '<span class="entry-words">' + words + 'w</span>';
      }
      html += '<button class="entry-action' + (e.pinned ? ' is-pinned' : '') + '" data-action="pin" data-id="' + e.id + '" aria-label="' + (e.pinned ? 'Unpin' : 'Pin') + ' entry">';
      html += '<svg viewBox="0 0 12 12"><path d="M3 1l6 6-2.5 .5L5 11l-1-3.5L1.5 7z" stroke-linejoin="round"/></svg>';
      html += (e.pinned ? 'Unpin' : 'Pin');
      html += '</button>';
      html += '<button class="entry-action" data-action="remove" data-id="' + e.id + '" aria-label="Remove entry">Remove</button>';
      html += '</div>';
      html += '</div>';
      html += '<div class="entry-body" data-action="open" data-id="' + e.id + '">' + QuietPageUtil.renderEntryBody(e.text) + '</div>';
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
      totalWords += QuietPageUtil.countWords(entries[i].text);
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
    var entries = QuietPageStorage.getEntries();
    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) { entry = entries[i]; break; }
    }
    if (!entry) return;

    var doRemove = function () {
      var filtered = entries.filter(function (e) { return e.id !== id; });
      QuietPageStorage.setEntries(filtered);
      document.dispatchEvent(new CustomEvent('quiet:entries-changed', { detail: { action: 'remove', id: id } }));
      QuietPageUtil.toast('Removed');
    };

    if (QuietPageStorage.getSettings().confirmDelete) {
      window.QuietPage.dialog.confirm({
        title: 'Remove entry?',
        message: 'This cannot be undone.',
        okLabel: 'Remove',
        cancelLabel: 'Cancel',
      }).then(function (ok) {
        if (ok) doRemove();
      });
    } else {
      doRemove();
    }
  }

  return {
    init: init,
    render: render,
    updateStats: updateStats,
    getFiltered: getFiltered,
  };
})();
