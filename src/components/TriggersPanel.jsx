import React from 'react';
import { Panel } from './ui.jsx';
import { AUTO_RULES } from '../config.js';
import { theme, fonts } from '../theme.js';

export function TriggersPanel({ sceneData, meta }) {
  return (
    <Panel title="Triggers & Rules" icon="⚡">
      <div style={{ fontSize: 10, color: theme.textDim, lineHeight: 1.6 }}>
        <div style={{
          marginBottom: 8, color: theme.text, fontSize: 11, fontWeight: 600,
        }}>
          Active Rules:
        </div>
        {AUTO_RULES.map((r) => {
          const active = r.condition(sceneData, meta);
          return (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
              borderBottom: `1px solid ${theme.panelBorder}20`,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: active ? theme.accent : theme.panelBorder,
              }} />
              <span style={{ color: active ? theme.text : theme.textDim }}>
                {r.label}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function SystemLogPanel({ log }) {
  return (
    <div style={{
      marginTop: 16, background: theme.panel,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: 8, padding: '12px 16px',
    }}>
      <div style={{
        fontSize: 10, color: theme.textDim, letterSpacing: '0.1em',
        textTransform: 'uppercase', marginBottom: 8, fontWeight: 600,
      }}>
        System Log
      </div>
      <div style={{
        maxHeight: 90, overflowY: 'auto', fontFamily: fonts.mono,
        fontSize: 10, background: theme.bg, borderRadius: 4, padding: 8,
      }}>
        {log.slice(-15).reverse().map((l, i) => (
          <div key={i} style={{
            padding: '2px 0',
            color: l.type === 'error' ? theme.danger
              : l.type === 'success' ? theme.accent
              : l.type === 'warn' ? theme.warn
              : theme.textDim,
          }}>
            <span style={{ color: theme.textDim }}>
              {l.time.toLocaleTimeString()}
            </span>{' '}
            {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
