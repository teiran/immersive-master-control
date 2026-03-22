import React from 'react';
import { Panel, Slider, Btn } from './ui.jsx';
import { CONFIG } from '../config.js';
import { theme, fonts } from '../theme.js';

export function WindPanel({
  connected,
  windMode, setWindMode,
  windIntensity, setWindIntensity,
  windAutoValue,
  effectiveWind,
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
            Auto: based on scene plant density
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

      <div style={{ fontSize: 9, color: theme.textDim }}>
        RPi endpoint: {CONFIG.RPI_WIND_API}
      </div>
    </Panel>
  );
}
