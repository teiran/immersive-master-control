import React, { useState, useEffect, useRef } from 'react';
import { Panel, Slider, Btn, NumberInput } from './ui.jsx';
import { CONFIG } from '../config.js';
import { theme, fonts } from '../theme.js';

export function WindPanel({
  connected,
  windMode, setWindMode,
  windIntensity, setWindIntensity,
  windAutoValue,
  effectiveWind,
  windSendInterval, setWindSendInterval,
  windLog,
}) {

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <NumberInput label="Interval ms" value={windSendInterval}
          onChange={setWindSendInterval} min={100} max={60000} step={100} />
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
