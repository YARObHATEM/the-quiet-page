/* ==========================================================================
   utils.js — shared pure helpers used by the renderer and main process
   ========================================================================== */

(function (root) {
  'use strict';

  /**
   * Splits raw entry text into a full title and body.
   * The returned title is never truncated; display surfaces decide their limit.
   *
   * @param {string} rawText
   * @returns {{ title: string, body: string }}
   */
  function extractTitleAndBody(rawText) {
    try {
      var text = typeof rawText === 'string' ? rawText.replace(/\r\n?/g, '\n') : '';
      if (!text.trim()) return { title: '', body: '' };

      var lines = text.split('\n');
      var titleIndex = -1;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim()) {
          titleIndex = i;
          break;
        }
      }

      if (titleIndex === -1) return { title: '', body: '' };

      var bodyLines = lines.slice(titleIndex + 1);
      while (bodyLines.length && !bodyLines[0].trim()) bodyLines.shift();

      return {
        title: lines[titleIndex].trim(),
        body: bodyLines.join('\n'),
      };
    } catch (_) {
      return { title: '', body: '' };
    }
  }

  function truncateTitle(title, maxLength) {
    var value = typeof title === 'string' ? title : '';
    var limit = Number.isFinite(Number(maxLength)) ? Math.max(1, Number(maxLength)) : 120;
    return value.length > limit ? value.slice(0, limit) + '…' : value;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      extractTitleAndBody: extractTitleAndBody,
      truncateTitle: truncateTitle,
    };
  }

  if (root) {
    root.extractTitleAndBody = extractTitleAndBody;
    root.truncateTitle = truncateTitle;
  }
})(typeof window !== 'undefined' ? window : null);
