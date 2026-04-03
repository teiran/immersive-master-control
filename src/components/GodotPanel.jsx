import React from 'react';
import { Panel, NumberInput } from './ui.jsx';
import { theme, fonts } from '../theme.js';

const PLANT_TYPES = [
  { key: 'flowers',    label: 'Kukat',     color: '#c474a0', icon: '🌸' },
  { key: 'evergreen',  label: 'Havupuut',  color: '#4a7c59', icon: '🌲' },
  { key: 'eucalyptus', label: 'Eukalyptus', color: '#7ca5b8', icon: '🌿' },
];

export function GodotPanel({ connected, sceneData, godotLog, pitchMin, setPitchMin, pitchMax, setPitchMax, pitchEnabled, setPitchEnabled }) {
  const total = (sceneData.flowers || 0) + (sceneData.evergreen || 0) + (sceneData.eucalyptus || 0);
  const alt = sceneData.altitude ?? 0;
  const currentPitch = pitchMin + (alt / 400) * (pitchMax - pitchMin);

  return (
    <Panel title="Godot Scene" icon="🌿" status={connected ? 'connected' : 'error'}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {PLANT_TYPES.map(p => (
          <div key={p.key} style={{
            background: p.color + '15', border: `1px solid ${p.color}30`,
            borderRadius: 6, padding: '10px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{p.icon}</div>
            <div style={{
              fontSize: 20, fontWeight: 700, color: p.color, fontFamily: fonts.mono,
            }}>
              {sceneData[p.key]}
            </div>
            <div style={{ fontSize: 9, color: theme.textDim, marginTop: 2 }}>{p.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10, color: theme.textDim, marginTop: 4 }}>
        Total: {total} plants
      </div>

      {/* Altitude → Pitch */}
      <div style={{
        background: theme.bg, borderRadius: 4, padding: 8, marginTop: 4,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={pitchEnabled} onChange={e => setPitchEnabled(e.target.checked)} />
            <span style={{ fontSize: 9, color: pitchEnabled ? theme.textDim : theme.danger, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Altitude → Pitch
            </span>
          </label>
          <span style={{ fontSize: 12, fontFamily: fonts.mono, fontWeight: 700, color: pitchEnabled ? theme.accent : theme.textDim }}>
            {pitchEnabled ? currentPitch.toFixed(2) + 'x' : 'OFF'}
          </span>
        </div>
        <div style={{
          height: 4, background: theme.panelBorder, borderRadius: 2, overflow: 'hidden', marginBottom: 6,
        }}>
          <div style={{
            width: `${Math.min(100, (alt / 400) * 100)}%`, height: '100%', borderRadius: 2,
            background: theme.accent, transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <NumberInput label="Low" value={pitchMin} onChange={setPitchMin} min={0.1} max={2.0} step={0.05} />
          <NumberInput label="High" value={pitchMax} onChange={setPitchMax} min={0.1} max={4.0} step={0.05} />
          <span style={{ fontSize: 9, color: theme.textDim, alignSelf: 'center' }}>
            Alt: {alt}
          </span>
        </div>
      </div>

      {/* Incoming data log */}
      <div style={{
        background: theme.bg, borderRadius: 4, padding: 8,
        maxHeight: 120, overflowY: 'auto', fontFamily: fonts.mono,
        fontSize: 9, color: theme.textDim,
      }}>
        {godotLog.length === 0 && <div>Waiting for Godot data...</div>}
        {godotLog.map((l, i) => (
          <div key={i}>
            <span style={{ color: theme.accent }}>{l.time}</span> {l.data}
          </div>
        ))}
      </div>
    </Panel>
  );
}
