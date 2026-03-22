import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CONFIG, AUDIO_LAYERS } from './config.js';
import { theme, fonts } from './theme.js';
import { createLogger } from './utils/logger.js';
import { SerialManager } from './utils/serial.js';
import * as api from './utils/api.js';

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
  const [sceneData, setSceneData] = useState({ trees: 0, flowers: 0, other: 0 });
  const [godotLog, setGodotLog] = useState([]);

  // ─── WIND ───────────────────────────────────────────────
  const [windMode, setWindMode] = useState('auto');
  const [windIntensity, setWindIntensity] = useState(30);
  const [windAutoValue, setWindAutoValue] = useState(0);

  // ─── SMELL ──────────────────────────────────────────────
  const [activeScent, setActiveScent] = useState('off');

  // ─── AUDIO ──────────────────────────────────────────────
  const [audioLevels, setAudioLevels] = useState(
    Object.fromEntries(AUDIO_LAYERS.map(l => [l.id, l.id === 'base' ? 70 : 50]))
  );
  const [audioMutes, setAudioMutes] = useState(
    Object.fromEntries(AUDIO_LAYERS.map(l => [l.id, false]))
  );
  const [masterVolume, setMasterVolume] = useState(80);
  const [motorwayAuto, setMotorwayAuto] = useState(true);
  const [sfxActive, setSfxActive] = useState(null);

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
  const motorwayTimer = useRef(null);

  // ─── GODOT POLLING ──────────────────────────────────────
  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const data = await api.fetchGodotScene();
        if (!active) return;

        setSceneData(data);
        setGodotConnected(true);

        // Auto-calculate wind from plant density
        if (windMode === 'auto') {
          const total = data.trees + data.flowers + data.other;
          setWindAutoValue(Math.min(100, Math.floor((total / 800) * 100)));
        }

        setGodotLog(prev => [...prev.slice(-8), {
          time: new Date().toLocaleTimeString(),
          data: `T:${data.trees} F:${data.flowers} O:${data.other}`,
        }]);
      } catch {
        if (!active) return;
        // If Godot unreachable, use simulation for development
        setGodotConnected(false);
        const mockData = {
          trees: Math.floor(Math.random() * 200) + 50,
          flowers: Math.floor(Math.random() * 500) + 100,
          other: Math.floor(Math.random() * 150) + 20,
        };
        setSceneData(mockData);
        if (windMode === 'auto') {
          const total = mockData.trees + mockData.flowers + mockData.other;
          setWindAutoValue(Math.min(100, Math.floor((total / 800) * 100)));
        }
        setGodotLog(prev => [...prev.slice(-8), {
          time: new Date().toLocaleTimeString(),
          data: `[SIM] T:${mockData.trees} F:${mockData.flowers} O:${mockData.other}`,
        }]);
      }
    };

    poll();
    const iv = setInterval(poll, CONFIG.GODOT_POLL_INTERVAL);
    return () => { active = false; clearInterval(iv); };
  }, [windMode]);

  // ─── WIND → RPI ─────────────────────────────────────────
  useEffect(() => {
    const val = windMode === 'manual' ? windIntensity : windAutoValue;

    api.sendWindCommand(val)
      .then(() => setRpiConnected(true))
      .catch(() => {
        setRpiConnected(false);
        // Silent fail in dev — RPi might not be available
      });
  }, [windIntensity, windAutoValue, windMode]);

  // ─── MOTORWAY AUTO DIM ──────────────────────────────────
  useEffect(() => {
    if (motorwayAuto && !audioMutes.moottoritie) {
      const tick = () => {
        const target = Math.floor(Math.random() * 60) + 10;
        setAudioLevels(prev => ({ ...prev, moottoritie: target }));
        motorwayTimer.current = setTimeout(tick,
          CONFIG.MOTORWAY_DIM_MIN + Math.random() * (CONFIG.MOTORWAY_DIM_MAX - CONFIG.MOTORWAY_DIM_MIN)
        );
      };
      tick();
    }
    return () => clearTimeout(motorwayTimer.current);
  }, [motorwayAuto, audioMutes.moottoritie]);

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
    serial.current.send(scent.cmd);
    log(`Scent → ${scent.label} (${scent.cmd})`);
  };

  // ─── SFX ────────────────────────────────────────────────
  const handleTriggerSfx = (sfx) => {
    setSfxActive(sfx.id);
    log(`SFX triggered: ${sfx.label}`);
    setTimeout(() => setSfxActive(null), 600);
  };

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
          audioLevels={audioLevels}
          setAudioLevels={setAudioLevels}
          audioMutes={audioMutes}
          setAudioMutes={setAudioMutes}
          motorwayAuto={motorwayAuto}
          setMotorwayAuto={setMotorwayAuto}
          sfxActive={sfxActive}
          onTriggerSfx={handleTriggerSfx}
        />

        {/* Right column */}
        <WindPanel
          connected={rpiConnected}
          windMode={windMode}
          setWindMode={setWindMode}
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
