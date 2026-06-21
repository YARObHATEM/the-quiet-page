/* ==========================================================================
   util.js — shared helpers (RTL detection, dates, formatting)
   ========================================================================== */

window.QuietPageUtil = (function () {
  'use strict';

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  var THEMES = ['sand','ivory','parchment','slate','midnight','forest'];

  function detectDirection(text) {
    if (!text) return 'ltr';
    var m = String(text).match(/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/);
    return m ? 'rtl' : 'ltr';
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
      var d = new Date(entries[i].createdAt);
      var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      days[key] = true;
    }
    var streak = 0;
    var today = new Date();
    for (var back = 0; back < 365; back++) {
      var check = new Date(today);
      check.setDate(check.getDate() - back);
      var key2 = check.getFullYear() + '-' + check.getMonth() + '-' + check.getDate();
      if (days[key2]) {
        streak++;
      } else if (back > 0) {
        break;
      }
    }
    return streak;
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
    langLabel: langLabel,
    countWords: countWords,
    escapeHtml: escapeHtml,
    ordinal: ordinal,
    toRoman: toRoman,
    formatEntryDate: formatEntryDate,
    formatDateForFile: formatDateForFile,
    renderEntryBody: renderEntryBody,
    previewText: previewText,
    calculateStreak: calculateStreak,
    calculateLongestStreak: calculateLongestStreak,
    toast: toast,
  };
})();
