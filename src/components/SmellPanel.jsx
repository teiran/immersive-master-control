import React from 'react';
import { Panel, Btn } from './ui.jsx';
import { SCENT_TYPES, CONFIG } from '../config.js';
import { theme, fonts } from '../theme.js';

export function SmellPanel({
  connected, onConnect, activeScent, onScentSelect,
  scentMode, setScentMode, scentPercentages,
  scentThreshold, setScentThreshold, scentDuty,
}) {
  const cycleSec = CONFIG.SCENT_CYCLE_INTERVAL / 1000;
  const activeSec = ((scentDuty / 100) * cycleSec).toFixed(1);

  return (
    <Panel title="Smell Machine" icon="👃" status={connected ? 'connected' : 'warning'}>
      <Btn onClick={onConnect} active={connected} color={theme.accent} small>
        {connected ? '✓ Connected' : 'Connect Arduino'}
      </Btn>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn active={scentMode === 'auto'} onClick={() => setScentMode('auto')} color={theme.accent} small>
          AUTO
        </Btn>
        <Btn active={scentMode === 'manual'} onClick={() => setScentMode('manual')} color={theme.accent} small>
          MANUAL
        </Btn>
      </div>

      {scentMode === 'auto' ? (
        /* Auto mode — show duty cycle, threshold, and percentages */
        <div>
          <div style={{ fontSize: 9, color: theme.textDim, marginBottom: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Cycle: {cycleSec}s — active: {activeSec}s ({scentDuty}%)
          </div>

          {/* Duty cycle bar */}
          <div style={{
            height: 6, background: theme.bg, borderRadius: 3, overflow: 'hidden', marginBottom: 6,
          }}>
            <div style={{
              width: `${scentDuty}%`, height: '100%', borderRadius: 3,
              background: theme.accent, transition: 'width 0.5s',
            }} />
          </div>

          {/* Threshold control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: theme.textDim, whiteSpace: 'nowrap' }}>
              100% at
            </span>
            <input type="range" min={1} max={200} value={scentThreshold}
              onChange={e => setScentThreshold(Number(e.target.value))}
              style={{ flex: 1, height: 4 }}
            />
            <span style={{ fontSize: 10, fontFamily: fonts.mono, color: theme.text, minWidth: 40, textAlign: 'right' }}>
              {scentThreshold} plants
            </span>
          </div>
          {SCENT_TYPES.filter(s => s.plant).map(scent => {
            const pct = scentPercentages[scent.plant] || 0;
            const time = ((pct / 100) * activeSec).toFixed(1);
            const isActive = activeScent === scent.id;

            return (
              <div key={scent.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                opacity: pct === 0 ? 0.3 : 1,
              }}>
                <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{scent.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{
                      fontSize: 10, fontFamily: fonts.mono,
                      color: isActive ? theme.accent : theme.text,
                      fontWeight: isActive ? 700 : 400,
                    }}>
                      {scent.label}
                    </span>
                    <span style={{ fontSize: 10, fontFamily: fonts.mono, color: theme.textDim }}>
                      {pct}% — {time}s
                    </span>
                  </div>
                  {/* Percentage bar */}
                  <div style={{
                    height: 4, background: theme.bg, borderRadius: 2, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: 2,
                      background: isActive ? theme.accent : theme.textDim,
                      transition: 'width 0.5s, background 0.3s',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Manual mode — scent buttons */
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
      )}

      <div style={{ fontSize: 9, color: theme.textDim }}>
        Active: {SCENT_TYPES.find(s => s.id === activeScent)?.label || 'Off'} │ Baud: {CONFIG.SERIAL_BAUD}
      </div>
    </Panel>
  );
}
