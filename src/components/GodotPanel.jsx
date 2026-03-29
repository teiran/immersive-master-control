import React from 'react';
import { Panel } from './ui.jsx';
import { theme, fonts } from '../theme.js';

const PLANT_TYPES = [
  { key: 'flowers',    label: 'Kukat',     color: '#c474a0', icon: '🌸' },
  { key: 'evergreen',  label: 'Havupuut',  color: '#4a7c59', icon: '🌲' },
  { key: 'eucalyptus', label: 'Eukalyptus', color: '#7ca5b8', icon: '🌿' },
];

export function GodotPanel({ connected, sceneData, godotLog }) {
  const total = (sceneData.flowers || 0) + (sceneData.evergreen || 0) + (sceneData.eucalyptus || 0);

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
