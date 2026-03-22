import React from 'react';
import { CONFIG } from '../config.js';
import { theme, fonts } from '../theme.js';

export function ApiFooter() {
  return (
    <div style={{
      marginTop: 16, padding: '12px 16px', background: theme.panel,
      border: `1px solid ${theme.panelBorder}`, borderRadius: 8,
      fontSize: 9, color: theme.textDim, fontFamily: fonts.mono,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: theme.text, fontSize: 10 }}>
        API Contracts
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ color: theme.accent }}>Godot → Master</div>
          <div>POST /api/scene</div>
          <div>{'{ trees, flowers, other }'}</div>
          <div style={{ color: theme.blue, marginTop: 4 }}>Master → Godot</div>
          <div>Response: {'{ wind, scent, story? }'}</div>
        </div>
        <div>
          <div style={{ color: theme.warn }}>Master → RPi</div>
          <div>POST {CONFIG.RPI_WIND_API}/wind</div>
          <div>{'{ intensity: 0-100 }'}</div>
        </div>
        <div>
          <div style={{ color: theme.accent }}>Master → Arduino</div>
          <div>Web Serial @ {CONFIG.SERIAL_BAUD} baud</div>
          <div>Commands: S0-S5 (scent select)</div>
        </div>
      </div>
    </div>
  );
}
