/* ==========================================================================
   util.js — shared helpers (RTL detection, dates, formatting)
   ========================================================================== */

window.QuietPageUtil = (function () {
  'use strict';

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  var THEMES = ['sage','old-paper','typewriter','candlelight','moonlight','dusk','slate','midnight','forest','ember','rose','obsidian','steel','aurora','cave','noir'];

  function detectDirection(text) {
    if (!text) return 'ltr';
    var value = String(text);
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      var ch = value.charAt(i);
      if (/\s/.test(ch) || isNeutralPunctuation(code, ch)) continue;
      return isRtlCode(code) ? 'rtl' : 'ltr';
    }
    return 'ltr';
  }

  function isRtlCode(code) {
    return (code >= 0x0590 && code <= 0x05FF) || (code >= 0x0600 && code <= 0x06FF);
  }

  function isNeutralPunctuation(code, ch) {
    if ((code >= 0x2000 && code <= 0x206F) || (code >= 0x2E00 && code <= 0x2E7F)) return true;
    if ((code >= 0x0030 && code <= 0x0039) || (code >= 0x0660 && code <= 0x0669)) return true;
    return /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\u060C\u061B\u061F\u00AB\u00BB\u2026\u2014\u2013]/.test(ch);
  }

  function looksArabic(text) {
    return detectDirection(text) === 'rtl';
  }

  function langLabel(dir) {
    return dir === 'rtl' ? 'AR' : 'EN';
  }

  function countWords(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
  }

  function ordinal(n) {
    var s = ['th','st','nd','rd'];
    var v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  }

  function toRoman(num) {
    var map = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],
               ['XC',90],['L',50],['XL',40],['X',10],['IX',9],
               ['V',5],['IV',4],['I',1]];
    var result = '';
    for (var i = 0; i < map.length; i++) {
      while (num >= map[i][1]) { result += map[i][0]; num -= map[i][1]; }
    }
    return result;
  }

  function formatEntryDate(iso) {
    var d = new Date(iso);
    return {
      day: d.getDate(),
      month: MONTHS[d.getMonth()],
      monthShort: MONTHS[d.getMonth()].slice(0,3),
      year: d.getFullYear(),
      time: pad2(d.getHours()) + ':' + pad2(d.getMinutes()),
      iso: d.toISOString().slice(0,10),
    };
  }

  function pad2(n) { return n < 10 ? '0'+n : ''+n; }

  function formatDateForFile(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
  }

  function renderEntryBody(text) {
    var lines = String(text).split('\n');
    var html = '';
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var dir = detectDirection(line) || 'ltr';
      var content = line.trim() === '' ? '&nbsp;' : escapeHtml(line);
      html += '<p dir="' + dir + '">' + content + '</p>';
    }
    return html;
  }

  function sanitizeEntryHtml(value) {
    var template = document.createElement('template');
    template.innerHTML = String(value || '');
    var allowed = { DIV: true, BR: true, STRONG: true, B: true, EM: true, I: true, U: true };
    var blocked = { SCRIPT: true, STYLE: true, IFRAME: true, OBJECT: true, EMBED: true, LINK: true, META: true };
    var nodes = Array.prototype.slice.call(template.content.querySelectorAll('*'));
    for (var i = nodes.length - 1; i >= 0; i--) {
      var node = nodes[i];
      if (blocked[node.tagName]) {
        node.remove();
        continue;
      }
      if (!allowed[node.tagName]) {
        node.replaceWith.apply(node, Array.prototype.slice.call(node.childNodes));
        continue;
      }
      var headingClass = node.tagName === 'DIV' && node.classList.contains('format-heading-1')
        ? 'format-heading-1'
        : (node.tagName === 'DIV' && node.classList.contains('format-heading-2') ? 'format-heading-2' : '');
      while (node.attributes.length) node.removeAttribute(node.attributes[0].name);
      if (headingClass) node.className = headingClass;
    }
    return template.innerHTML;
  }

  function renderFormattedEntry(html, fallbackText) {
    var safe = sanitizeEntryHtml(html);
    if (!safe) return renderEntryBody(fallbackText);
    var template = document.createElement('template');
    template.innerHTML = safe;
    var children = Array.prototype.slice.call(template.content.children);
    if (!children.length || children.some(function (node) { return node.tagName !== 'DIV'; })) {
      return renderEntryBody(fallbackText);
    }
    var output = '';
    for (var i = 0; i < children.length; i++) {
      var line = children[i];
      var dir = detectDirection(line.textContent || '');
      var tag = line.classList.contains('format-heading-1') ? 'h1' : (line.classList.contains('format-heading-2') ? 'h2' : 'p');
      var content = line.innerHTML.trim() ? line.innerHTML : '&nbsp;';
      output += '<' + tag + ' dir="' + dir + '">' + content + '</' + tag + '>';
    }
    return output;
  }

  function emptyIcon(name) {
    var icons = {
      page: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M9 13h6"/><path d="M9 17h3"/></svg>',
      search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/></svg>',
      chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19l16 0"/><path d="M4 15l4 -6l4 3l4 -7l4 5"/><path d="M4 4l0 15"/></svg>',
      tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z"/></svg>',
    };
    return icons[name] || icons.page;
  }

  function emptyStateHtml(icon, message, detail) {
    var dir = detectDirection(message);
    return '<div class="empty-state-inner">' +
      '<div class="empty-state-icon">' + emptyIcon(icon) + '</div>' +
      '<div class="empty-state-message" dir="' + dir + '">' + escapeHtml(message) + '</div>' +
      (detail ? '<span>' + escapeHtml(detail) + '</span>' : '') +
      '</div>';
  }

  function previewText(text, maxChars) {
    var t = String(text || '').replace(/\n+/g, ' ').trim();
    if (!t) return '';
    if (t.length <= (maxChars || 140)) return t;
    return t.slice(0, maxChars || 140) + '…';
  }

  function calculateStreak(entries) {
    if (!entries.length) return 0;
    var days = {};
    for (var i = 0; i < entries.length; i++) {
      addEntryDay(days, entries[i].createdAt);
      addEntryDay(days, entries[i].updatedAt);
    }
    var streak = 0;
    var today = new Date();
    for (var back = 0; back < 100000; back++) {
      var check = new Date(today);
      check.setDate(check.getDate() - back);
      var key2 = check.getFullYear() + '-' + check.getMonth() + '-' + check.getDate();
      if (!days[key2]) break;
      streak++;
    }
    return streak;
  }

  function addEntryDay(days, value) {
    if (!value) return;
    var date = new Date(value);
    if (isNaN(date.getTime())) return;
    days[date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate()] = true;
  }

  function calculateLongestStreak(entries) {
    if (!entries.length) return 0;
    var days = {};
    for (var i = 0; i < entries.length; i++) {
      var d = new Date(entries[i].createdAt);
      var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      days[key] = true;
    }
    // Convert to sorted YYYY-MM-DD list using actual dates
    var dateList = [];
    for (var k in days) {
      var parts = k.split('-');
      dateList.push(new Date(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])));
    }
    dateList.sort(function (a, b) { return a - b; });
    var longest = 1;
    var current = 1;
    for (var j = 1; j < dateList.length; j++) {
      var prev = dateList[j-1];
      var curr = dateList[j];
      var diff = Math.round((curr - prev) / 86400000);
      if (diff === 1) {
        current++;
        if (current > longest) longest = current;
      } else if (diff === 0) {
        // same day, no change
      } else {
        current = 1;
      }
    }
    return longest;
  }

  /* ----- Toast notifications ----- */
  var toastTimer = null;
  function toast(message, type) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' is-error' : '');
    el.textContent = message;
    container.appendChild(el);
    void el.offsetWidth;
    el.classList.add('is-visible');
    setTimeout(function () {
      el.classList.remove('is-visible');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 400);
    }, 2400);
  }

  return {
    MONTHS: MONTHS,
    THEMES: THEMES,
    detectDirection: detectDirection,
    looksArabic: looksArabic,
    langLabel: langLabel,
    countWords: countWords,
    escapeHtml: escapeHtml,
    ordinal: ordinal,
    toRoman: toRoman,
    formatEntryDate: formatEntryDate,
    formatDateForFile: formatDateForFile,
    renderEntryBody: renderEntryBody,
    sanitizeEntryHtml: sanitizeEntryHtml,
    renderFormattedEntry: renderFormattedEntry,
    emptyStateHtml: emptyStateHtml,
    previewText: previewText,
    calculateStreak: calculateStreak,
    calculateLongestStreak: calculateLongestStreak,
    toast: toast,
  };
})();
