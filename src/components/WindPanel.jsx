import React, { useState, useEffect, useRef } from 'react';
import { Panel, Slider, Btn } from './ui.jsx';
import { CONFIG } from '../config.js';
import { theme, fonts } from '../theme.js';

export function WindPanel({
  connected,
  windMode, setWindMode,
  windIntensity, setWindIntensity,
  windAutoValue,
  effectiveWind,
  windSendInterval, setWindSendInterval,
}) {
  const [windLog, setWindLog] = useState([]);
  const effectiveRef = useRef(effectiveWind);
  effectiveRef.current = effectiveWind;

  useEffect(() => {
    const id = setInterval(() => {
      setWindLog(prev => [...prev.slice(-5), {
        time: new Date().toLocaleTimeString(),
        speed: effectiveRef.current,
      }]);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel title="Wind Machine" icon="💨" status={connected ? 'connected' : 'warning'}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        <Btn
          active={windMode === 'auto'}
          onClick={() => setWindMode('auto')}
          color={theme.blue}
        >
          AUTO
        </Btn>
        <Btn
          active={windMode === 'manual'}
          onClick={() => setWindMode('manual')}
          color={theme.warn}
        >
          MANUAL
        </Btn>
      </div>

      {windMode === 'manual' ? (
        <Slider
          value={windIntensity}
          onChange={setWindIntensity}
          color={theme.warn}
          label="Intensity"
        />
      ) : (
        <div>
          <div style={{ fontSize: 10, color: theme.textDim, marginBottom: 4 }}>
            Auto: controlled by Godot
          </div>
          <Slider value={windAutoValue} onChange={() => {}} color={theme.blue} label="Auto" />
        </div>
      )}

      {/* Wind visualization */}
      <div style={{
        height: 48, background: theme.bg, borderRadius: 6, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i / 12) * 100}%`,
            width: 2,
            height: `${(effectiveWind / 100) * 40 + 4}px`,
            background: windMode === 'manual' ? theme.warn : theme.blue,
            opacity: 0.4,
            borderRadius: 1,
            transition: 'height 0.5s ease',
          }} />
        ))}
        <span style={{
          fontSize: 24, fontWeight: 700, color: theme.text,
          zIndex: 1, fontFamily: fonts.mono,
        }}>
          {effectiveWind}%
        </span>
      </div>

      {/* Send interval */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 9, color: theme.textDim, whiteSpace: 'nowrap' }}>
          Send every
        </span>
        <input type="range" min={1} max={30} value={windSendInterval}
          onChange={e => setWindSendInterval(Number(e.target.value))}
          style={{ flex: 1, height: 4 }}
        />
        <span style={{ fontSize: 10, fontFamily: fonts.mono, color: theme.text, minWidth: 24, textAlign: 'right' }}>
          {windSendInterval}s
        </span>
      </div>

      {/* Wind speed log */}
      <div style={{
        background: theme.bg, borderRadius: 4, padding: 6, marginTop: 4,
        maxHeight: 60, overflowY: 'auto', fontFamily: fonts.mono,
        fontSize: 9, color: theme.textDim,
      }}>
        {windLog.length === 0 && <div>Logging every 5s...</div>}
        {windLog.map((l, i) => (
          <div key={i}>
            <span style={{ color: theme.accent }}>{l.time}</span> speed: {l.speed}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 9, color: theme.textDim }}>
        RPi: {CONFIG.RPI_WIND_API}/set?speed=N
      </div>
    </Panel>
  );
}
