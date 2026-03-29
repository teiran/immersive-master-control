import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CONFIG, DEFAULT_TRACKS } from './config.js';
import { theme, fonts } from './theme.js';
import { createLogger } from './utils/logger.js';
import { SerialManager } from './utils/serial.js';
import { AudioEngine } from './utils/audio.js';
import { GroupPlaybackController } from './utils/groupPlayback.js';
import * as api from './utils/api.js';
import { SCENT_TYPES } from './config.js';

// Components
import { GodotPanel } from './components/GodotPanel.jsx';
import { AudioPanel } from './components/AudioPanel.jsx';
import { WindPanel } from './components/WindPanel.jsx';
import { SmellPanel } from './components/SmellPanel.jsx';
import { StoryPanel } from './components/StoryPanel.jsx';
import { TriggersPanel, SystemLogPanel } from './components/TriggersPanel.jsx';
import { ApiFooter } from './components/ApiFooter.jsx';

export default function App() {
  // ─── CONNECTION STATE ───────────────────────────────────
  const [godotConnected, setGodotConnected] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [rpiConnected, setRpiConnected] = useState(false);

  // ─── SCENE DATA ─────────────────────────────────────────
  const [sceneData, setSceneData] = useState({
    flowers: 0, evergreen: 0, eucalyptus: 0,
    dayNightCycle: 0, waterCloseness: 0, cloudiness: 0, rain: 0, onField: false,
  });
  const [godotLog, setGodotLog] = useState([]);

  // ─── WIND ───────────────────────────────────────────────
  const [windMode, setWindMode] = useState('auto');
  const [windIntensity, setWindIntensity] = useState(30);
  const [windAutoValue, setWindAutoValue] = useState(0);

  // ─── SMELL ──────────────────────────────────────────────
  const [activeScent, setActiveScent] = useState('off');
  const [scentMode, setScentMode] = useState('manual'); // 'manual' | 'auto'
  const [scentPercentages, setScentPercentages] = useState({ flowers: 0, evergreen: 0, eucalyptus: 0 });
  const [scentThreshold, setScentThreshold] = useState(20); // plants needed for 100% scent
  const [scentDuty, setScentDuty] = useState(0); // 0-100% of cycle active

  // ─── AUDIO ──────────────────────────────────────────────
  const [tracks, setTracks] = useState(
    DEFAULT_TRACKS.map(t => ({ ...t, volume: t.id === 'base' ? 70 : 50, muted: false, fileName: null, loaded: false }))
  );
  const [trackGroups, setTrackGroups] = useState([]);
  const trackGroupsRef = useRef([]);
  const [masterVolume, setMasterVolume] = useState(80);

  // ─── AI STORY ───────────────────────────────────────────
  const [storyImages, setStoryImages] = useState([]);
  const [currentStory, setCurrentStory] = useState(null);
  const [storyPlaying, setStoryPlaying] = useState(false);
  const [storyGenerating, setStoryGenerating] = useState(false);

  // ─── SYSTEM LOG ─────────────────────────────────────────
  const [systemLog, setSystemLog] = useState([
    { time: new Date(), msg: 'Master Control initialized', type: 'info' },
  ]);
  const log = useCallback(createLogger(setSystemLog), []);

  // ─── REFS ───────────────────────────────────────────────
  const serial = useRef(new SerialManager(CONFIG.SERIAL_BAUD));
  const audioEngineRef = useRef(new AudioEngine());
  const groupControllerRef = useRef(new GroupPlaybackController(audioEngineRef.current));
  const scentTimers = useRef([]);
  const stateLoaded = useRef(false);
  const saveTimer = useRef(null);

  // Keep ref in sync for stable callback access
  useEffect(() => { trackGroupsRef.current = trackGroups; }, [trackGroups]);

  // Wire up group controller update callback
  useEffect(() => {
    groupControllerRef.current.onGroupUpdate = (groupId, updates) => {
      setTrackGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
    };
    groupControllerRef.current.getLatestGroup = (groupId) => {
      return trackGroupsRef.current.find(g => g.id === groupId);
    };
  }, []);

  // ─── RESTORE SAVED STATE ON STARTUP ─────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await api.loadState();
        if (!saved) { stateLoaded.current = true; return; }

        if (saved.tracks) setTracks(saved.tracks);
        if (saved.trackGroups) setTrackGroups(saved.trackGroups);
        if (saved.masterVolume != null) setMasterVolume(saved.masterVolume);
        if (saved.windMode) setWindMode(saved.windMode);
        if (saved.windIntensity != null) setWindIntensity(saved.windIntensity);
        if (saved.scentMode) setScentMode(saved.scentMode);
        if (saved.activeScent) setActiveScent(saved.activeScent);
        if (saved.scentThreshold != null) setScentThreshold(saved.scentThreshold);

        // Re-load audio buffers from server (decoding works even with suspended context)
        const engine = audioEngineRef.current;
        await engine.init();
        for (const track of (saved.tracks || [])) {
          if (track.serverPath) {
            try {
              const url = `http://${location.hostname}:3001${track.serverPath}`;
              await engine.addLayer(track.id, url, {
                loop: track.type === 'loop',
                volume: (track.volume ?? 50) / 100,
              });
              // Set region
              const buf = engine.getBuffer(track.id);
              if (buf && (track.regionStart || track.regionEnd)) {
                engine.setLayerRegion(track.id,
                  (track.regionStart ?? 0) * buf.duration,
                  (track.regionEnd ?? 1) * buf.duration
                );
              }
            } catch (err) {
              console.warn(`[Audio] Failed to restore ${track.label}:`, err.message);
            }
          }
        }

        // Re-load group sub-track audio files
        for (const group of (saved.trackGroups || [])) {
          for (const sub of group.subTracks) {
            if (sub.serverPath) {
              try {
                const url = `http://${location.hostname}:3001${sub.serverPath}`;
                await engine.addLayer(sub.id, url, {
                  loop: group.type === 'loop',
                  volume: (sub.volume ?? 50) / 100,
                });
              } catch (err) {
                console.warn(`[Audio] Failed to restore sub-track ${sub.label}:`, err.message);
              }
            }
          }
        }

        // Defer playback until user clicks anywhere (browser autoplay policy)
        const startPlayback = async () => {
          await engine.resume();
          // Play tracks that were playing
          for (const track of (saved.tracks || [])) {
            if (track.serverPath && track.type === 'loop' && track.playing !== false) {
              engine.playLayer(track.id);
            }
          }
          // Re-start groups that were playing
          for (const group of (saved.trackGroups || [])) {
            if (group.playing && group.type === 'loop') {
              groupControllerRef.current.startGroup(group);
            }
          }
          document.removeEventListener('click', startPlayback);
          document.removeEventListener('keydown', startPlayback);
        };

        if (engine.ctx?.state === 'suspended') {
          document.addEventListener('click', startPlayback, { once: true });
          document.addEventListener('keydown', startPlayback, { once: true });
          console.log('[State] Restored — click anywhere to start audio');
        } else {
          await startPlayback();
          console.log('[State] Restored');
        }
      } catch (err) {
        console.warn('[State] Could not restore:', err.message);
      }
      stateLoaded.current = true;
    })();
  }, []);

  // ─── AUTO-SAVE STATE (debounced 2s after any change) ───
  useEffect(() => {
    if (!stateLoaded.current) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.saveState({
        tracks: tracks.map(t => ({
          id: t.id, label: t.label, type: t.type, color: t.color,
          sceneLink: t.sceneLink, triggerKey: t.triggerKey,
          volume: t.volume, muted: t.muted, playing: t.playing ?? true,
          fileName: t.fileName, loaded: t.loaded,
          serverPath: t.serverPath || null,
          speed: t.speed ?? 100,
          regionStart: t.regionStart ?? 0, regionEnd: t.regionEnd ?? 1,
          autoDim: t.autoDim || false, autoDimRandom: t.autoDimRandom || false,
          autoDimMin: t.autoDimMin, autoDimMax: t.autoDimMax, autoDimSpeed: t.autoDimSpeed,
          autoSpeed: t.autoSpeed || false, autoSpeedRandom: t.autoSpeedRandom || false,
          autoSpeedMin: t.autoSpeedMin, autoSpeedMax: t.autoSpeedMax,
          intensifyTarget: t.intensifyTarget || null,
          intensifyAmount: t.intensifyAmount, intensifyDuration: t.intensifyDuration,
        })),
        trackGroups,
        masterVolume,
        windMode,
        windIntensity,
        scentMode,
        activeScent,
        scentThreshold,
      }).catch(() => {});
    }, 2000);
  }, [tracks, trackGroups, masterVolume, windMode, windIntensity, scentMode, activeScent, scentThreshold]);

  // ─── AUDIO ENGINE SYNC ─────────────────────────────────
  useEffect(() => {
    const engine = audioEngineRef.current;
    for (const track of tracks) {
      engine.setLayerVolume(track.id, (track.volume ?? 50) / 100);
      engine.setLayerMute(track.id, !!track.muted);
      engine.setLayerSpeed(track.id, (track.speed ?? 100) / 100);
      // Sync region
      const buf = engine.getBuffer(track.id);
      if (buf && (track.regionStart != null || track.regionEnd != null)) {
        engine.setLayerRegion(
          track.id,
          (track.regionStart ?? 0) * buf.duration,
          (track.regionEnd ?? 1) * buf.duration
        );
      }
    }
  }, [tracks]);

  // Sync group sub-track volumes
  useEffect(() => {
    const engine = audioEngineRef.current;
    for (const group of trackGroups) {
      for (const sub of group.subTracks) {
        const vol = (group.volume / 100) * ((sub.volume ?? 50) / 100);
        engine.setLayerVolume(sub.id, group.muted ? 0 : vol);
        engine.setLayerSpeed(sub.id, (sub.speed ?? 100) / 100);
      }
    }
  }, [trackGroups]);

  useEffect(() => {
    audioEngineRef.current.setMasterVolume(masterVolume / 100);
  }, [masterVolume]);

  // ─── SCENE-LINKED AUTO VOLUME ─────────────────────────
  // Tracks with a sceneLink get their volume driven by scene data
  useEffect(() => {
    setTracks(prev => prev.map(track => {
      if (!track.sceneLink || track.muted) return track;

      let sceneVal = sceneData[track.sceneLink];
      if (sceneVal === undefined) return track;

      // Boolean scene values (onField) → 0 or 80
      if (typeof sceneVal === 'boolean') {
        sceneVal = sceneVal ? 80 : 0;
      }
      // dayNightCycle (0–1) → birds louder during day, quieter at night
      else if (track.sceneLink === 'dayNightCycle') {
        // 0=midnight, 0.5=noon → volume peaks at noon
        sceneVal = Math.round((1 - Math.abs(sceneVal - 0.5) * 2) * 80);
      }
      // Other numeric values (0–100) → map to volume
      else {
        sceneVal = Math.min(100, Math.max(0, Math.round(sceneVal * 0.8)));
      }

      return { ...track, volume: sceneVal };
    }));
  }, [sceneData]);

  // ─── WEBSOCKET — RECEIVE SCENE DATA FROM SERVER ─────────
  // Scene data updates on every Godot POST (up to 10/s).
  // Log is throttled to ~2/s to stay readable.
  const wsRef = useRef(null);
  const lastLogTime = useRef(0);

  useEffect(() => {
    let closed = false;

    function connect() {
      if (closed) return;
      const ws = new WebSocket(`ws://${location.hostname}:3001/ws`);
      wsRef.current = ws;

      ws.onopen = () => setGodotConnected(true);

      ws.onclose = () => {
        setGodotConnected(false);
        if (!closed) setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'scene') {
          const { _seq, ...scene } = msg.data;
          setSceneData(scene);

          // Throttle log entries to ~2/s so the panel stays readable
          const now = Date.now();
          if (now - lastLogTime.current >= 500) {
            lastLogTime.current = now;
            setGodotLog(prev => [...prev.slice(-14), {
              time: new Date().toLocaleTimeString(),
              data: `#${_seq ?? '?'} F:${scene.flowers} E:${scene.evergreen} U:${scene.eucalyptus}`,
            }]);
          }
        }

        if (msg.type === 'wind') {
          setWindAutoValue(msg.data.speed);
          if (msg.data.mode) setWindMode(msg.data.mode);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      wsRef.current?.close();
    };
  }, []);

  // ─── WIND MODE SWITCH ────────────────────────────────────
  // Notify server when mode changes so it knows whether to forward Godot wind
  const handleWindModeChange = (mode) => {
    setWindMode(mode);
    api.setWindMode(mode).catch(() => {});
  };

  // ─── WIND MANUAL → RPI ─────────────────────────────────
  // Only send from UI when in manual mode, resend every 5s
  const windValRef = useRef(windIntensity);
  useEffect(() => { windValRef.current = windIntensity; }, [windIntensity]);

  useEffect(() => {
    if (windMode !== 'manual') return;
    function sendWind() {
      api.sendWindCommand(windValRef.current, 'manual')
        .then(() => setRpiConnected(true))
        .catch(() => setRpiConnected(false));
    }
    sendWind();
    const id = setInterval(sendWind, 5000);
    return () => clearInterval(id);
  }, [windIntensity, windMode]);

  // ─── KEYBOARD TRIGGERS ─────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const key = e.key.toUpperCase();
      const track = tracks.find(t => t.type === 'trigger' && t.triggerKey === key && t.loaded);
      if (track) { handleTriggerTrack(track); return; }

      const group = trackGroups.find(g => g.triggerKey === key);
      if (group) {
        const ctrl = groupControllerRef.current;
        if (group.type === 'trigger') {
          ctrl.triggerGroup(group);
          log(`Group trigger: ${group.label}`);
        } else if (group.playing) {
          // Already playing — advance to next sub-track
          ctrl.advanceGroup(group);
          log(`Group advance: ${group.label}`);
        } else {
          // Start playing
          ctrl.startGroup(group);
          setTrackGroups(prev => prev.map(g => g.id === group.id ? { ...g, playing: true } : g));
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tracks, trackGroups]);

  // ─── AUTO-DRIFT — smooth 1-unit drift for volume and/or speed ──
  // Each track drifts 1 unit per step. Direction reverses at min/max.
  // If random is on, direction may randomly flip mid-drift.
  const dimIntervals = useRef({});
  const dimDirections = useRef({}); // track id → { vol: 1|-1, speed: 1|-1 }

  useEffect(() => {
    const activeDimTracks = tracks.filter(t =>
      (t.autoDim || t.autoSpeed) && t.loaded && !t.muted && t.playing !== false
    );
    const activeIds = new Set(activeDimTracks.map(t => t.id));

    // Clear intervals for tracks that no longer need drifting
    for (const id of Object.keys(dimIntervals.current)) {
      if (!activeIds.has(id)) {
        clearInterval(dimIntervals.current[id]);
        delete dimIntervals.current[id];
        delete dimDirections.current[id];
      }
    }

    // Start intervals for tracks that need drifting
    for (const track of activeDimTracks) {
      if (dimIntervals.current[track.id]) continue;

      if (!dimDirections.current[track.id]) {
        dimDirections.current[track.id] = {
          vol: Math.random() > 0.5 ? 1 : -1,
          speed: Math.random() > 0.5 ? 1 : -1,
        };
      }

      const stepMs = track.autoDimSpeed ?? 200;

      dimIntervals.current[track.id] = setInterval(() => {
        setTracks(prev => prev.map(t => {
          if (t.id !== track.id) return t;
          const dirs = dimDirections.current[t.id];
          const updates = {};

          // Volume drift
          if (t.autoDim) {
            const min = t.autoDimMin ?? 10;
            const max = t.autoDimMax ?? 80;
            let vol = t.volume ?? 50;
            let vDir = dirs.vol || 1;

            if (vol >= max) vDir = -1;
            else if (vol <= min) vDir = 1;
            else if (t.autoDimRandom && Math.random() < 0.05) vDir = -vDir;

            dirs.vol = vDir;
            updates.volume = Math.min(max, Math.max(min, vol + vDir));
          }

          // Speed drift
          if (t.autoSpeed) {
            const sMin = t.autoSpeedMin ?? 80;
            const sMax = t.autoSpeedMax ?? 120;
            let spd = t.speed ?? 100;
            let sDir = dirs.speed || 1;

            if (spd >= sMax) sDir = -1;
            else if (spd <= sMin) sDir = 1;
            else if (t.autoSpeedRandom && Math.random() < 0.05) sDir = -sDir;

            dirs.speed = sDir;
            updates.speed = Math.min(sMax, Math.max(sMin, spd + sDir));
          }

          return { ...t, ...updates };
        }));
      }, stepMs);
    }

    return () => {
      for (const iv of Object.values(dimIntervals.current)) clearInterval(iv);
      dimIntervals.current = {};
    };
  }, [tracks.map(t => `${t.id}:${t.autoDim}:${t.autoSpeed}:${t.loaded}:${t.muted}:${t.playing}:${t.autoDimSpeed}`).join(',')]);

  // ─── TRIGGER INTENSIFY — triggers can smoothly boost a target track
  const intensifyTimers = useRef({});

  const handleTriggerTrack = (track) => {
    if (!track.loaded) return;
    audioEngineRef.current.playSfx(track.id);
    log(`Trigger: ${track.label}`);

    if (track.intensifyTarget) {
      const amount = track.intensifyAmount ?? 20;
      const duration = track.intensifyDuration ?? 3000;
      const targetId = track.intensifyTarget;

      // Clear any existing intensify timer for this target
      if (intensifyTimers.current[targetId]) {
        clearInterval(intensifyTimers.current[targetId].up);
        clearInterval(intensifyTimers.current[targetId].down);
        clearTimeout(intensifyTimers.current[targetId].wait);
      }

      // Ramp up 1% per step
      const stepMs = 50;
      let stepped = 0;
      const upInterval = setInterval(() => {
        stepped++;
        if (stepped >= amount) { clearInterval(upInterval); return; }
        setTracks(prev => prev.map(t =>
          t.id === targetId ? { ...t, volume: Math.min(100, (t.volume ?? 50) + 1) } : t
        ));
      }, stepMs);

      // After duration, ramp back down
      const waitTimer = setTimeout(() => {
        let downStepped = 0;
        const downInterval = setInterval(() => {
          downStepped++;
          if (downStepped >= amount) { clearInterval(downInterval); return; }
          setTracks(prev => prev.map(t =>
            t.id === targetId ? { ...t, volume: Math.max(0, (t.volume ?? 50) - 1) } : t
          ));
        }, stepMs);
        intensifyTimers.current[targetId] = { ...intensifyTimers.current[targetId], down: downInterval };
      }, duration);

      intensifyTimers.current[targetId] = { up: upInterval, wait: waitTimer };
    }
  };

  // ─── SCENT AUTO CYCLE ───────────────────────────────────
  // Every SCENT_CYCLE_INTERVAL (10s), run scents proportionally.
  // Active time scales with total plants: 0 plants = 0s, threshold+ = full cycle.
  // Within the active time, each scent runs for its share of the plant mix.
  useEffect(() => {
    if (scentMode !== 'auto') return;

    const clearTimers = () => scentTimers.current.forEach(t => clearTimeout(t));

    const cycle = () => {
      clearTimers();
      scentTimers.current = [];

      const total = sceneData.flowers + sceneData.evergreen + sceneData.eucalyptus;
      if (total === 0) {
        serial.current.send('stop\n');
        setActiveScent('off');
        setScentPercentages({ flowers: 0, evergreen: 0, eucalyptus: 0 });
        setScentDuty(0);
        return;
      }

      // Scale active time: 0 plants → 0%, threshold+ → 100%
      const duty = Math.min(1, total / scentThreshold);
      setScentDuty(Math.round(duty * 100));

      const pct = {
        flowers: sceneData.flowers / total,
        evergreen: sceneData.evergreen / total,
        eucalyptus: sceneData.eucalyptus / total,
      };
      setScentPercentages({
        flowers: Math.round(pct.flowers * 100),
        evergreen: Math.round(pct.evergreen * 100),
        eucalyptus: Math.round(pct.eucalyptus * 100),
      });

      const interval = CONFIG.SCENT_CYCLE_INTERVAL;
      const activeTime = interval * duty;

      const schedule = [
        { ...SCENT_TYPES.find(s => s.id === 'flowers'), duration: pct.flowers * activeTime },
        { ...SCENT_TYPES.find(s => s.id === 'evergreen'), duration: pct.evergreen * activeTime },
        { ...SCENT_TYPES.find(s => s.id === 'eucalyptus'), duration: pct.eucalyptus * activeTime },
      ].filter(s => s.duration > 200);

      let offset = 0;
      for (const step of schedule) {
        const t = setTimeout(() => {
          serial.current.send(`${step.cmd}\n`);
          setActiveScent(step.id);
        }, offset);
        scentTimers.current.push(t);
        offset += step.duration;
      }

      // Stop after active time if not running full cycle
      if (duty < 1) {
        const stopT = setTimeout(() => {
          serial.current.send('stop\n');
          setActiveScent('off');
        }, activeTime);
        scentTimers.current.push(stopT);
      }
    };

    cycle();
    const iv = setInterval(cycle, CONFIG.SCENT_CYCLE_INTERVAL);

    return () => {
      clearInterval(iv);
      scentTimers.current.forEach(t => clearTimeout(t));
    };
  }, [scentMode, sceneData, scentThreshold]);

  // ─── SERIAL CONNECT ─────────────────────────────────────
  const connectSerial = async () => {
    const mgr = serial.current;
    mgr.onConnect = () => { setSerialConnected(true); log('Arduino connected via Web Serial', 'success'); };
    mgr.onDisconnect = () => { setSerialConnected(false); log('Arduino disconnected', 'warn'); };
    mgr.onError = (err) => log(`Serial error: ${err.message}`, 'error');
    mgr.onData = (data) => log(`Serial RX: ${data.trim()}`);

    try {
      await mgr.connect();
    } catch (err) {
      log(`Serial: ${err.message}`, 'error');
    }
  };

  const handleScentSelect = (scent) => {
    setActiveScent(scent.id);
    serial.current.send(`${scent.cmd}\n`);
    log(`Scent → ${scent.label} (${scent.cmd})`);
  };

  // ─── TRIGGER TRACKS ─────────────────────────────────────
  // (handleTriggerTrack defined above with intensify logic)

  // ─── IMAGE & STORY ──────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = { id: Date.now(), src: ev.target.result, name: file.name };
      setStoryImages(prev => [img, ...prev.slice(0, 9)]);
      log(`Image scanned: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateStory = async (image) => {
    setStoryGenerating(true);
    log('Generating AI story...', 'info');
    try {
      const base64 = image.src.split(',')[1];
      const text = await api.generateStory(base64);
      setCurrentStory({ text, image, time: new Date() });
      log('AI story generated', 'success');
    } catch (err) {
      log(`Story error: ${err.message}`, 'error');
      setCurrentStory({
        text: '[Demo] Metsässä asui pieni kettu, joka kuunteli tuulen tarinaa puiden latvoja pitkin. Tuuli kuiskasi tarinoita kaukaisista maista, joissa kukat lauloivat ja puut tanssivat...',
        image,
        time: new Date(),
      });
    }
    setStoryGenerating(false);
  };

  // ─── DERIVED ────────────────────────────────────────────
  const effectiveWind = windMode === 'manual' ? windIntensity : windAutoValue;

  // ─── RENDER ─────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      color: theme.text,
      fontFamily: fonts.mono,
      fontSize: 13,
      padding: 20,
      backgroundImage: `
        radial-gradient(ellipse at 20% 50%, #0d1f1422 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, #0a1a1222 0%, transparent 50%)
      `,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, padding: '0 4px',
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 22, fontFamily: fonts.display, fontWeight: 700,
            color: theme.accent, letterSpacing: '0.02em',
          }}>
            Multi-sensory Immersive System
          </h1>
          <p style={{
            margin: '4px 0 0', fontSize: 10, color: theme.textDim,
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            Master Control ▸ Art Installation
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {[
            { label: 'Godot', ok: godotConnected },
            { label: 'Arduino', ok: serialConnected },
            { label: 'RPi', ok: rpiConnected },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: s.ok ? theme.accent : theme.danger,
                boxShadow: s.ok ? `0 0 6px ${theme.accent}66` : 'none',
              }} />
              <span style={{ fontSize: 10, color: theme.textDim }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.6fr 1fr',
        gap: 16,
      }}>
        {/* Left column */}
        <GodotPanel
          connected={godotConnected}
          sceneData={sceneData}
          godotLog={godotLog}
        />

        {/* Center */}
        <AudioPanel
          masterVolume={masterVolume}
          setMasterVolume={setMasterVolume}
          tracks={tracks}
          setTracks={setTracks}
          trackGroups={trackGroups}
          setTrackGroups={setTrackGroups}
          trackGroupsRef={trackGroupsRef}
          audioEngine={audioEngineRef.current}
          groupController={groupControllerRef.current}
          onTriggerTrack={handleTriggerTrack}
        />

        {/* Right column */}
        <WindPanel
          connected={rpiConnected}
          windMode={windMode}
          setWindMode={handleWindModeChange}
          windIntensity={windIntensity}
          setWindIntensity={setWindIntensity}
          windAutoValue={windAutoValue}
          effectiveWind={effectiveWind}
        />

        {/* Second row */}
        <SmellPanel
          connected={serialConnected}
          onConnect={connectSerial}
          activeScent={activeScent}
          onScentSelect={handleScentSelect}
          scentMode={scentMode}
          setScentMode={setScentMode}
          scentPercentages={scentPercentages}
          scentThreshold={scentThreshold}
          setScentThreshold={setScentThreshold}
          scentDuty={scentDuty}
        />

        <StoryPanel
          storyImages={storyImages}
          onImageUpload={handleImageUpload}
          currentStory={currentStory}
          storyGenerating={storyGenerating}
          storyPlaying={storyPlaying}
          setStoryPlaying={setStoryPlaying}
          onGenerateStory={handleGenerateStory}
          onSendToGodot={() => log('Story → Godot world')}
        />

        <TriggersPanel
          sceneData={sceneData}
          meta={{ hasImages: storyImages.length > 0 }}
        />
      </div>

      <SystemLogPanel log={systemLog} />
      <ApiFooter />
    </div>
  );
}
