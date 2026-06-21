/* ==========================================================================
   sound.js — Web Audio synthesized typewriter sounds
   Preserved from the original; only the storage hook changes.
   ========================================================================== */

window.QuietPageSound = (function () {
  'use strict';

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var settings = null;

  function init(s) { settings = s; }

  function updateSettings(s) {
    settings = s;
    if (master) master.gain.value = (s.volume / 100) * 0.6;
  }

  function ensureContext() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = ((settings ? settings.volume : 40) / 100) * 0.6;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
  }

  function getNoise() {
    if (noiseBuffer) return noiseBuffer;
    var sr = ctx.sampleRate;
    var len = Math.floor(sr * 0.15);
    var buf = ctx.createBuffer(1, len, sr);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
    return buf;
  }

  function playKey(key) {
    if (!settings || !settings.soundEnabled) return;
    if (!ensureContext()) return;
    resume();
    try {
      if (key === 'Enter') playReturn();
      else if (key === ' ') playSpace();
      else if (key === 'Backspace') playBackspace();
      else if (typeof key === 'string' && key.length === 1) playType();
    } catch (e) {}
  }

  function playType() {
    var now = ctx.currentTime;
    var type = settings.soundType;

    var noise = ctx.createBufferSource();
    noise.buffer = getNoise();
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';

    if (type === 'typewriter') {
      filter.frequency.value = 1800 + Math.random() * 600;
      filter.Q.value = 0.8;
    } else if (type === 'mechanical') {
      filter.frequency.value = 1200 + Math.random() * 400;
      filter.Q.value = 2;
    } else {
      filter.frequency.value = 600;
      filter.Q.value = 0.4;
    }

    var noiseGain = ctx.createGain();
    var peak = type === 'soft' ? 0.12 : 0.28;
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(peak, now + 0.001);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + 0.04);

    if (type !== 'soft') {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 160 + Math.random() * 50;
      var oscGain = ctx.createGain();
      var bodyPeak = type === 'mechanical' ? 0.18 : 0.14;
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(bodyPeak, now + 0.002);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(oscGain);
      oscGain.connect(master);
      osc.start(now);
      osc.stop(now + 0.03);
    }
  }

  function playSpace() {
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.05);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.07);
    playType();
  }

  function playReturn() {
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  function playBackspace() {
    var now = ctx.currentTime;
    var noise = ctx.createBufferSource();
    noise.buffer = getNoise();
    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2500;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + 0.03);
  }

  function playBell() {
    if (!settings || !settings.bellOnPublish) return;
    if (!ensureContext()) return;
    resume();
    try {
      var now = ctx.currentTime;
      var partials = [
        { freq: 1760, peak: 0.28, decay: 0.9 },
        { freq: 3520, peak: 0.10, decay: 0.6 },
        { freq: 5280, peak: 0.05, decay: 0.4 },
      ];
      for (var i = 0; i < partials.length; i++) {
        var p = partials[i];
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = p.freq;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(p.peak, now + 0.004);
        g.gain.exponentialRampToValueAtTime(0.001, now + p.decay);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + p.decay + 0.05);
      }
    } catch (e) {}
  }

  function testSound() {
    if (!ensureContext()) return;
    resume();
    playType();
    setTimeout(playSpace, 200);
    setTimeout(playReturn, 400);
    setTimeout(playBell, 700);
  }

  return {
    init: init,
    updateSettings: updateSettings,
    ensureContext: ensureContext,
    resume: resume,
    playKey: playKey,
    playType: playType,
    playSpace: playSpace,
    playReturn: playReturn,
    playBackspace: playBackspace,
    playBell: playBell,
    testSound: testSound,
  };
})();
