/* ==========================================================================
   insights.js — Insights tab: stats + charts (pure HTML/CSS bars)
   ========================================================================== */

window.QuietPageInsights = (function () {
  'use strict';

  function init() {
    // Nothing to wire — re-render happens on entries-changed & tab activation.
  }

  function render() {
    var entries = QuietPageStorage.getEntries();
    var totalWords = 0;
    var totalEntries = entries.length;
    for (var i = 0; i < entries.length; i++) {
      totalWords += QuietPageUtil.countWords(entries[i].text);
    }
    var streak = QuietPageUtil.calculateStreak(entries);
    var longest = QuietPageUtil.calculateLongestStreak(entries);
    var avg = totalEntries > 0 ? Math.round(totalWords / totalEntries) : 0;
    var monthWords = countThisMonthWords(entries);

    setText('insTotalWords', totalWords);
    setText('insTotalEntries', totalEntries);
    setText('insStreak', streak);
    setText('insLongest', longest);
    setText('insAvgWords', avg);
    setText('insMonthWords', monthWords);

    renderLast30Days(entries);
    renderByDayOfWeek(entries);
  }

  function countThisMonthWords(entries) {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    var sum = 0;
    for (var i = 0; i < entries.length; i++) {
      var d = new Date(entries[i].createdAt);
      if (d.getFullYear() === y && d.getMonth() === m) {
        sum += QuietPageUtil.countWords(entries[i].text);
      }
    }
    return sum;
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function renderLast30Days(entries) {
    var chartEl = document.getElementById('insChart');
    if (!chartEl) return;
    chartEl.innerHTML = '';

    // Build a map: 'YYYY-MM-DD' -> words
    var dayWords = {};
    for (var i = 0; i < entries.length; i++) {
      var d = new Date(entries[i].createdAt);
      var key = d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate());
      dayWords[key] = (dayWords[key] || 0) + QuietPageUtil.countWords(entries[i].text);
    }

    // Find max for scaling
    var maxWords = 1;
    for (var k in dayWords) {
      if (dayWords[k] > maxWords) maxWords = dayWords[k];
    }

    // Build 30 bars (oldest → newest, left → right)
    var today = new Date();
    var frag = document.createDocumentFragment();
    for (var back = 29; back >= 0; back--) {
      var d2 = new Date(today);
      d2.setDate(d2.getDate() - back);
      var key2 = d2.getFullYear() + '-' + pad2(d2.getMonth()+1) + '-' + pad2(d2.getDate());
      var words = dayWords[key2] || 0;
      var heightPct = Math.max(2, (words / maxWords) * 100);
      var bar = document.createElement('div');
      bar.className = 'insight-chart-bar' + (back === 0 ? ' is-today' : '');
      bar.style.height = heightPct + '%';
      var dayLabel = (d2.getMonth()+1) + '/' + d2.getDate();
      bar.setAttribute('data-tip', dayLabel + ' · ' + words + ' words');
      frag.appendChild(bar);
    }
    chartEl.appendChild(frag);
  }

  function renderByDayOfWeek(entries) {
    var chartEl = document.getElementById('insDowChart');
    if (!chartEl) return;
    chartEl.innerHTML = '';

    // Count words per day-of-week
    var dowWords = [0,0,0,0,0,0,0]; // Sun..Sat
    for (var i = 0; i < entries.length; i++) {
      var d = new Date(entries[i].createdAt);
      dowWords[d.getDay()] += QuietPageUtil.countWords(entries[i].text);
    }

    var max = 1;
    for (var j = 0; j < 7; j++) if (dowWords[j] > max) max = dowWords[j];

    var labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var frag = document.createDocumentFragment();
    for (var n = 0; n < 7; n++) {
      var wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = 'center';
      wrap.style.flex = '1';
      wrap.style.gap = '0.35rem';

      var bar = document.createElement('div');
      bar.className = 'insight-chart-bar';
      bar.style.width = '100%';
      bar.style.height = Math.max(2, (dowWords[n] / max) * 80) + 'px';
      bar.setAttribute('data-tip', labels[n] + ' · ' + dowWords[n] + ' words');
      wrap.appendChild(bar);

      var lbl = document.createElement('div');
      lbl.style.fontFamily = "'Inter', sans-serif";
      lbl.style.fontSize = '0.54rem';
      lbl.style.letterSpacing = '0.18em';
      lbl.style.textTransform = 'uppercase';
      lbl.style.color = 'var(--text-muted)';
      lbl.textContent = labels[n];
      wrap.appendChild(lbl);

      frag.appendChild(wrap);
    }
    chartEl.appendChild(frag);
  }

  function pad2(n) { return n < 10 ? '0'+n : ''+n; }

  return { init: init, render: render };
})();
