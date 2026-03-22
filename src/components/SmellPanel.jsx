import React from 'react';
import { Panel, Btn } from './ui.jsx';
import { SCENT_TYPES, CONFIG } from '../config.js';
import { theme, fonts } from '../theme.js';

export function SmellPanel({ connected, onConnect, activeScent, onScentSelect }) {
  return (
    <Panel title="Smell Machine" icon="👃" status={connected ? 'connected' : 'warning'}>
      <Btn onClick={onConnect} active={connected} color={theme.accent} small>
        {connected ? '✓ Connected' : 'Connect Arduino'}
      </Btn>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {SCENT_TYPES.map(scent => (
          <button
            key={scent.id}
            onClick={() => onScentSelect(scent)}
            style={{
              background: activeScent === scent.id ? theme.accent + '22' : theme.bg,
              border: `1px solid ${activeScent === scent.id ? theme.accent : theme.panelBorder}`,
              borderRadius: 6, padding: '10px 6px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 20 }}>{scent.icon}</span>
            <span style={{
              fontSize: 9, fontFamily: fonts.mono,
              color: activeScent === scent.id ? theme.accent : theme.textDim,
            }}>
              {scent.label}
            </span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 9, color: theme.textDim }}>
        Active: {SCENT_TYPES.find(s => s.id === activeScent)?.label} │ Baud: {CONFIG.SERIAL_BAUD}
      </div>
    </Panel>
  );
}
