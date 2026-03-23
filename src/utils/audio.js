// ─── AUDIO ENGINE ────────────────────────────────────────────
// Manages layered audio playback with Web Audio API
// Supports: looping layers, volume/mute, crossfade, SFX one-shots

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.layers = new Map();   // id → { source, gainNode, buffer, playing }
    this.sfxBuffers = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.initialized = true;
  }

  async resume() {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Load an audio file into a buffer
  async loadBuffer(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.ctx.decodeAudioData(arrayBuffer);
  }

  // ─── LAYER MANAGEMENT ─────────────────────────────────

  async addLayer(id, url, { loop = true, volume = 0.5 } = {}) {
    await this.init();

    try {
      const buffer = await this.loadBuffer(url);
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = volume;
      gainNode.connect(this.masterGain);

      this.layers.set(id, {
        buffer,
        gainNode,
        source: null,
        loop,
        playing: false,
        volume,
        muted: false,
      });

      return true;
    } catch (err) {
      console.warn(`[Audio] Failed to load layer "${id}":`, err.message);
      // Create a placeholder layer even if file is missing
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = volume;
      gainNode.connect(this.masterGain);
      this.layers.set(id, {
        buffer: null,
        gainNode,
        source: null,
        loop,
        playing: false,
        volume,
        muted: false,
      });
      return false;
    }
  }

  // Load a layer from a dropped File object
  async addLayerFromFile(id, file, { loop = true, volume = 0.5 } = {}) {
    await this.init();

    const arrayBuffer = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);

    // Stop existing layer if playing
    this.stopLayer(id);

    const existing = this.layers.get(id);
    const gainNode = existing?.gainNode ?? this.ctx.createGain();
    if (!existing) gainNode.connect(this.masterGain);

    const prevVolume = existing?.volume ?? volume;
    const prevMuted = existing?.muted ?? false;
    gainNode.gain.value = prevMuted ? 0 : prevVolume;

    if (loop) {
      // Looping layer — add and auto-play
      this.layers.set(id, {
        buffer, gainNode, source: null, loop: true,
        playing: false, volume: prevVolume, muted: prevMuted,
        fileName: file.name,
      });
      this.playLayer(id);
    } else {
      // One-shot trigger — store as SFX buffer
      this.sfxBuffers.set(id, buffer);
      this.layers.set(id, {
        buffer, gainNode, source: null, loop: false,
        playing: false, volume: prevVolume, muted: prevMuted,
        fileName: file.name,
      });
    }
    return true;
  }

  playLayer(id) {
    const layer = this.layers.get(id);
    if (!layer || !layer.buffer || layer.playing) return;

    const source = this.ctx.createBufferSource();
    source.buffer = layer.buffer;
    source.loop = layer.loop;
    source.connect(layer.gainNode);
    source.start(0);

    layer.source = source;
    layer.playing = true;

    source.onended = () => {
      if (!layer.loop) {
        layer.playing = false;
        layer.source = null;
      }
    };
  }

  stopLayer(id) {
    const layer = this.layers.get(id);
    if (!layer || !layer.playing) return;

    try {
      layer.source?.stop();
    } catch (e) {
      // Already stopped
    }
    layer.source = null;
    layer.playing = false;
  }

  // Smooth volume transition
  setLayerVolume(id, volume, fadeTime = 0.3) {
    const layer = this.layers.get(id);
    if (!layer) return;

    layer.volume = volume;
    if (!layer.muted) {
      layer.gainNode.gain.linearRampToValueAtTime(
        volume,
        this.ctx.currentTime + fadeTime
      );
    }
  }

  setLayerMute(id, muted) {
    const layer = this.layers.get(id);
    if (!layer) return;

    layer.muted = muted;
    const targetVol = muted ? 0 : layer.volume;
    layer.gainNode.gain.linearRampToValueAtTime(
      targetVol,
      this.ctx.currentTime + 0.2
    );
  }

  setMasterVolume(volume, fadeTime = 0.3) {
    if (!this.masterGain) return;
    this.masterGain.gain.linearRampToValueAtTime(
      volume,
      this.ctx.currentTime + fadeTime
    );
  }

  // ─── SFX ONE-SHOTS ────────────────────────────────────

  async loadSfx(id, url) {
    await this.init();
    try {
      const buffer = await this.loadBuffer(url);
      this.sfxBuffers.set(id, buffer);
      return true;
    } catch (err) {
      console.warn(`[Audio] Failed to load SFX "${id}":`, err.message);
      return false;
    }
  }

  playSfx(id, volume = 0.8) {
    const buffer = this.sfxBuffers.get(id);
    if (!buffer) {
      console.log(`[Audio] SFX "${id}" not loaded, would play here`);
      return;
    }

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;

    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(0);
  }

  // ─── PLAYBACK CONTROL ─────────────────────────────────

  playAll() {
    for (const [id] of this.layers) {
      this.playLayer(id);
    }
  }

  stopAll() {
    for (const [id] of this.layers) {
      this.stopLayer(id);
    }
  }

  dispose() {
    this.stopAll();
    this.ctx?.close();
    this.layers.clear();
    this.sfxBuffers.clear();
    this.initialized = false;
  }
}

export default AudioEngine;
