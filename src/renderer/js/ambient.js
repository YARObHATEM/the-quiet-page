/* ==========================================================================
   ambient.js — local ambient moods sharing the typewriter AudioContext
   ========================================================================== */

window.QuietPageAmbient = (function () {
  'use strict';

  var MOODS = {
    rain: { type: 'synth' },
    forest: { type: 'file', src: 'audio/ambient/forest-clean.ogg' },
    cafe: { type: 'file', src: 'audio/ambient/cafe.ogg' },
    lofi: { type: 'file', src: 'audio/ambient/lofi.ogg' },
    fireplace: { type: 'file', src: 'audio/ambient/fireplace.ogg' },
    ocean: { type: 'file', src: 'audio/ambient/ocean.ogg' },
    thunder: { type: 'file', src: 'audio/ambient/thunder.ogg' },
    birds: { type: 'file', src: 'audio/ambient/birds.ogg' },
    river: { type: 'file', src: 'audio/ambient/river.ogg' },
    wind: { type: 'file', src: 'audio/ambient/wind.ogg' },
    train: { type: 'file', src: 'audio/ambient/train.ogg' },
    night: { type: 'file', src: 'audio/ambient/night.ogg' },
    'white-noise': { type: 'synth' },
  };
  var MOOD_LABELS = {
    rain: 'Rain',
    forest: 'Forest',
    cafe: 'Café',
    lofi: 'Lo-fi',
    fireplace: 'Fireplace',
    ocean: 'Ocean',
    thunder: 'Thunder',
    birds: 'Birds',
    river: 'River',
    wind: 'Wind',
    train: 'Train',
    night: 'Night',
    'white-noise': 'White Noise',
  };
  var CROSSFADE_SECONDS = 0.5;
  var IDLE_DELAY_MS = 8000;
  var IDLE_LEVEL = 0.6;
  var IDLE_FADE_SECONDS = 3;
  var ACTIVE_FADE_SECONDS = 1.5;

  var settings = null;
  var panel = null;
  var volumeWrap = null;
  var volumeInput = null;
  var stopButton = null;
  var buttons = [];
  var context = null;
  var master = null;
  var selectedMood = null;
  var activeMood = null;
  var activeScene = null;
  var idleTimer = null;
  var idleLevel = 1;
  var filePlayers = {};

  function init(initialSettings) {
    settings = initialSettings || settings || window.QuietPageStorage.getSettings();
    panel = document.getElementById('ambientPanel');
    volumeWrap = document.getElementById('ambientVolumeWrap');
    volumeInput = document.getElementById('ambientVolume');
    stopButton = document.getElementById('ambientStop');
    buttons = Array.prototype.slice.call(document.querySelectorAll('.ambient-btn[data-mood]'));
    if (!panel || !volumeInput || !stopButton) return;

    Object.keys(MOODS).forEach(function (name) {
      if (MOODS[name].available !== false) enableMood(name);
    });

    selectedMood = MOODS[settings.ambientMood] && MOODS[settings.ambientMood].available !== false
      ? settings.ambientMood
      : null;
    volumeInput.value = clampVolume(settings.ambientVolume);

    for (var i = 0; i < buttons.length; i++) {
      (function (button) {
        button.addEventListener('click', function () {
          startMood(button.getAttribute('data-mood'));
        });
      })(buttons[i]);
    }

    stopButton.addEventListener('click', stop);
    volumeInput.addEventListener('input', function () {
      var volume = clampVolume(volumeInput.value);
      settings.ambientVolume = volume;
      window.QuietPageStorage.patchSettings({ ambientVolume: volume });
      applyMasterLevel(0.08);
    });

    var composer = document.getElementById('composer');
    if (composer) composer.addEventListener('input', onComposerInput);
    document.addEventListener('quiet:tab-changed', onTabChanged);

    preflightFiles();
    updateUI();
  }

  function updateSettings(nextSettings) {
    settings = nextSettings || settings;
    if (!settings) return;
    if (volumeInput) volumeInput.value = clampVolume(settings.ambientVolume);
    applyMasterLevel(0.08);
  }

  function preflightFiles() {
    Object.keys(MOODS).forEach(function (name) {
      if (MOODS[name].type !== 'file') return;
      if (MOODS[name].available === false) {
        disableMood(name);
        return;
      }
      var audio = new Audio();
      audio.preload = 'metadata';
      audio.loop = true;
      audio.src = MOODS[name].src;
      audio.addEventListener('error', function () { disableMood(name); }, { once: true });
      filePlayers[name] = {
        audio: audio,
        source: null,
        gain: null,
        stopTimer: null,
        generation: 0,
      };
      audio.load();
    });
  }

  function ensureAudio() {
    context = window.QuietPageSound.getContext();
    if (!context) return false;
    window.QuietPageSound.resume();
    if (!master) {
      master = context.createGain();
      master.gain.value = targetMasterLevel();
      master.connect(context.destination);
    }
    return true;
  }

  function startMood(name) {
    if (!MOODS[name] || MOODS[name].available === false || isMoodDisabled(name) || !ensureAudio()) return;

    selectedMood = name;
    settings.ambientMood = name;
    window.QuietPageStorage.patchSettings({ ambientMood: name });

    if (activeMood === name && activeScene) {
      updateUI();
      return;
    }

    var scene = MOODS[name].type === 'file'
      ? createFileScene(name)
      : createSynthScene(name);
    if (!scene) return;

    var previous = activeScene;
    activeScene = scene;
    activeMood = name;
    idleLevel = 1;
    setIdleState('full');
    applyMasterLevel(ACTIVE_FADE_SECONDS);

    fadeScene(scene, MOODS[name].gain || 1, CROSSFADE_SECONDS);
    if (previous) {
      fadeScene(previous, 0, CROSSFADE_SECONDS);
      window.setTimeout(function () { previous.stop(); }, CROSSFADE_SECONDS * 1000 + 60);
    }

    scheduleIdle();
    updateUI();
  }

  function createFileScene(name) {
    var player = filePlayers[name];
    if (!player) return null;
    player.generation += 1;
    var generation = player.generation;
    if (player.stopTimer) {
      clearTimeout(player.stopTimer);
      player.stopTimer = null;
    }

    try {
      if (!player.source) {
        player.source = context.createMediaElementSource(player.audio);
        player.gain = context.createGain();
        player.gain.gain.value = 0;
        player.source.connect(player.gain);
        player.gain.connect(master);
      }
      player.gain.gain.cancelScheduledValues(context.currentTime);
      player.gain.gain.setValueAtTime(0, context.currentTime);
      var playPromise = player.audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          disableMood(name);
          if (activeMood === name) stop();
        });
      }
    } catch (e) {
      disableMood(name);
      return null;
    }

    return {
      gain: player.gain,
      stop: function () {
        if (player.generation !== generation) return;
        player.stopTimer = window.setTimeout(function () {
          if (player.generation !== generation) return;
          player.audio.pause();
          player.audio.currentTime = 0;
          player.stopTimer = null;
        }, 0);
      },
    };
  }

  function createSynthScene(name) {
    if (name === 'rain') return createRainScene();
    if (name === 'white-noise') return createWhiteNoiseScene();
    return null;
  }

  function createRainScene() {
    var sceneGain = context.createGain();
    sceneGain.gain.value = 0;
    sceneGain.connect(master);

    var buffer = context.createBuffer(2, context.sampleRate * 8, context.sampleRate);
    for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
      var data = buffer.getChannelData(channel);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }

    var source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    var highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 350;
    var lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 6200;
    var rainGain = context.createGain();
    rainGain.gain.value = 0.32;
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(rainGain);
    rainGain.connect(sceneGain);

    var rumble = context.createBufferSource();
    rumble.buffer = buffer;
    rumble.loop = true;
    var rumbleFilter = context.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 180;
    var rumbleGain = context.createGain();
    rumbleGain.gain.value = 0.08;
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(sceneGain);

    source.start();
    rumble.start();
    return {
      gain: sceneGain,
      stop: function () {
        try { source.stop(); } catch (e) {}
        try { rumble.stop(); } catch (e) {}
        sceneGain.disconnect();
      },
    };
  }

  function createWhiteNoiseScene() {
    var sceneGain = context.createGain();
    sceneGain.gain.value = 0;
    sceneGain.connect(master);

    var noise = createWhiteNoise(context);
    noise.output.connect(sceneGain);
    noise.source.start();

    return {
      gain: sceneGain,
      stop: function () {
        try { noise.source.stop(); } catch (e) {}
        noise.output.disconnect();
        sceneGain.disconnect();
      },
    };
  }

  function createWhiteNoise(audioContext) {
    var bufferSize = audioContext.sampleRate * 2;
    var buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    var source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    var filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    var gain = audioContext.createGain();
    gain.gain.value = 0.55;

    source.connect(filter);
    filter.connect(gain);

    return { source: source, output: gain };
  }

  function fadeScene(scene, target, seconds) {
    if (!scene || !scene.gain || !context) return;
    var now = context.currentTime;
    var param = scene.gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + seconds);
  }

  function stop() {
    clearIdleTimer();
    if (activeScene && context) {
      var previous = activeScene;
      fadeScene(previous, 0, CROSSFADE_SECONDS);
      window.setTimeout(function () { previous.stop(); }, CROSSFADE_SECONDS * 1000 + 60);
    }
    activeScene = null;
    activeMood = null;
    idleLevel = 1;
    setIdleState('full');
    updateUI();
  }

  function onComposerInput() {
    if (!activeScene || currentTab() !== 'write') return;
    idleLevel = 1;
    setIdleState('full');
    applyMasterLevel(ACTIVE_FADE_SECONDS);
    scheduleIdle();
  }

  function onTabChanged() {
    clearIdleTimer();
    idleLevel = 1;
    setIdleState('full');
    applyMasterLevel(ACTIVE_FADE_SECONDS);
    if (activeScene && currentTab() === 'write') scheduleIdle();
  }

  function scheduleIdle() {
    clearIdleTimer();
    if (!activeScene || currentTab() !== 'write') return;
    idleTimer = window.setTimeout(function () {
      if (!activeScene || currentTab() !== 'write') return;
      idleLevel = IDLE_LEVEL;
      setIdleState('dimmed');
      applyMasterLevel(IDLE_FADE_SECONDS);
    }, IDLE_DELAY_MS);
  }

  function clearIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }

  function applyMasterLevel(seconds) {
    if (!master || !context) return;
    var now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(targetMasterLevel(), now + (seconds || 0.01));
  }

  function targetMasterLevel() {
    return (clampVolume(settings && settings.ambientVolume) / 100) * idleLevel;
  }

  function updateUI() {
    if (!panel) return;
    panel.dataset.playing = activeScene ? 'true' : 'false';
    panel.dataset.mood = selectedMood || '';
    for (var i = 0; i < buttons.length; i++) {
      var mood = buttons[i].getAttribute('data-mood');
      var isSelected = mood === selectedMood;
      var isActive = mood === activeMood && !!activeScene;
      buttons[i].classList.toggle('is-selected', isSelected);
      buttons[i].classList.toggle('is-active', isActive);
      buttons[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
    stopButton.disabled = !activeScene;
    volumeWrap.classList.toggle('is-visible', !!activeScene);
  }

  function setIdleState(state) {
    if (panel) panel.dataset.idle = state;
  }

  function disableMood(name) {
    if (MOODS[name]) MOODS[name].available = false;
    var button = document.querySelector('.ambient-btn[data-mood="' + name + '"]');
    if (button) {
      var label = moodLabel(name);
      button.disabled = true;
      button.setAttribute('data-unavailable', 'true');
      button.classList.add('is-unavailable');
      button.title = label + ' - Unavailable';
      button.setAttribute('aria-label', label + ' ambience unavailable');
    }
  }

  function enableMood(name) {
    var button = document.querySelector('.ambient-btn[data-mood="' + name + '"]');
    if (!button) return;
    var label = moodLabel(name);
    button.disabled = false;
    button.removeAttribute('data-unavailable');
    button.classList.remove('is-unavailable');
    button.title = label;
    button.setAttribute('aria-label', 'Play ' + label.toLowerCase() + ' ambience');
  }

  function isMoodDisabled(name) {
    var button = document.querySelector('.ambient-btn[data-mood="' + name + '"]');
    return !button || button.disabled;
  }

  function currentTab() {
    return window.QuietPageTabs ? window.QuietPageTabs.current() : 'write';
  }

  function clampVolume(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return 40;
    return Math.min(100, Math.max(0, Math.round(number)));
  }

  function moodLabel(name) {
    return MOOD_LABELS[name] || name;
  }

  return {
    init: init,
    updateSettings: updateSettings,
    stop: stop,
  };
})();
