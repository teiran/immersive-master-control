import React from 'react';
import { theme, fonts } from '../theme.js';

// ─── PANEL ───────────────────────────────────────────────────

export function Panel({ title, icon, status, children, span = 1, style = {} }) {
  return (
    <div style={{
      background: theme.panel,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: 8,
      padding: '16px 20px',
      gridColumn: span > 1 ? `span ${span}` : undefined,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>
      {/* Status bar top edge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: status === 'connected' ? theme.accent
          : status === 'error' ? theme.danger
          : status === 'warning' ? theme.warn
          : theme.panelBorder,
        opacity: 0.8,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{
          margin: 0, fontSize: 11, fontFamily: fonts.mono, fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.textDim,
        }}>
          <span style={{ marginRight: 8 }}>{icon}</span>{title}
        </h3>
        {status && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: status === 'connected' ? theme.accent
              : status === 'error' ? theme.danger : theme.warn,
            boxShadow: status === 'connected' ? `0 0 8px ${theme.accent}44` : 'none',
          }} />
        )}
      </div>
      {children}
    </div>
  );
}

// ─── SLIDER ──────────────────────────────────────────────────

export function Slider({ value, onChange, min = 0, max = 100, color = theme.accent, label, showValue = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
      {label && (
        <span style={{ fontSize: 10, color: theme.textDim, minWidth: 60, fontFamily: fonts.mono }}>
          {label}
        </span>
      )}
      <div style={{ flex: 1, position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', height: 4, left: 0, right: 0,
          background: theme.panelBorder, borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute', height: 4, left: 0,
          width: `${((value - min) / (max - min)) * 100}%`,
          background: color, borderRadius: 2,
        }} />
        <input
          type="range" min={min} max={max} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', width: '100%', height: 20,
            opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
        <div style={{
          position: 'absolute',
          left: `calc(${((value - min) / (max - min)) * 100}% - 7px)`,
          width: 14, height: 14, borderRadius: '50%',
          background: color, border: `2px solid ${theme.bg}`,
          boxShadow: `0 0 6px ${color}44`, pointerEvents: 'none',
        }} />
      </div>
      {showValue && (
        <span style={{
          fontSize: 11, color: theme.text, fontFamily: fonts.mono,
          minWidth: 30, textAlign: 'right',
        }}>
          {value}%
        </span>
      )}
    </div>
  );
}

// ─── BUTTON ──────────────────────────────────────────────────

// ─── NUMBER INPUT ───────────────────────────────────────────

export function NumberInput({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 8, color: theme.textDim }}>{label}</span>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: 55, background: theme.panel, border: `1px solid ${theme.panelBorder}`,
          color: theme.text, padding: '2px 4px', borderRadius: 3,
          fontFamily: fonts.mono, fontSize: 9, outline: 'none',
        }}
      />
    </label>
  );
}

// ─── BUTTON ──────────────────────────────────────────────────

export function Btn({ children, onClick, active, color = theme.accent, small, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: active ? color + '22' : 'transparent',
      border: `1px solid ${active ? color : theme.panelBorder}`,
      color: active ? color : theme.textDim,
      padding: small ? '4px 10px' : '8px 16px',
      borderRadius: 6, fontFamily: fonts.mono, fontSize: small ? 10 : 11,
      cursor: disabled ? 'not-allowed' : 'pointer',
      letterSpacing: '0.05em', transition: 'all 0.2s',
      opacity: disabled ? 0.4 : 1, fontWeight: 500,
    }}>
      {children}
    </button>
  );
}
