import React, { useRef, useEffect, useState, useCallback } from 'react';
import { theme } from '../theme.js';

// Draws audio waveform with draggable start/end region selection
export function Waveform({ buffer, regionStart = 0, regionEnd = 1, onChange, color = theme.accent, height = 40 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // 'start' | 'end' | 'region' | null
  const dragOrigin = useRef({ x: 0, start: 0, end: 0 });

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));

    ctx.clearRect(0, 0, w, h);

    // Draw full waveform (dimmed)
    ctx.fillStyle = theme.panelBorder + '66';
    for (let i = 0; i < w; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const val = data[i * step + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const y1 = ((1 - max) / 2) * h;
      const y2 = ((1 - min) / 2) * h;
      ctx.fillRect(i, y1, 1, y2 - y1);
    }

    // Draw selected region (bright)
    const sx = Math.floor(regionStart * w);
    const ex = Math.floor(regionEnd * w);
    ctx.fillStyle = color + '44';
    ctx.fillRect(sx, 0, ex - sx, h);

    ctx.fillStyle = color;
    for (let i = sx; i < ex; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const val = data[i * step + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const y1 = ((1 - max) / 2) * h;
      const y2 = ((1 - min) / 2) * h;
      ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
    }

    // Draw handles
    ctx.fillStyle = color;
    ctx.fillRect(sx, 0, 2, h);
    ctx.fillRect(ex - 2, 0, 2, h);
  }, [buffer, regionStart, regionEnd, color, height]);

  const getPosition = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const pos = getPosition(e);
    const startDist = Math.abs(pos - regionStart);
    const endDist = Math.abs(pos - regionEnd);
    const threshold = 0.03;

    if (startDist < threshold) {
      setDragging('start');
    } else if (endDist < threshold) {
      setDragging('end');
    } else if (pos > regionStart && pos < regionEnd) {
      setDragging('region');
      dragOrigin.current = { x: pos, start: regionStart, end: regionEnd };
    } else {
      // Click outside region — set new region start
      onChange?.(pos, regionEnd < pos ? 1 : regionEnd);
    }
  }, [regionStart, regionEnd, getPosition, onChange]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e) => {
      const pos = getPosition(e);
      if (dragging === 'start') {
        onChange?.(Math.min(pos, regionEnd - 0.01), regionEnd);
      } else if (dragging === 'end') {
        onChange?.(regionStart, Math.max(pos, regionStart + 0.01));
      } else if (dragging === 'region') {
        const delta = pos - dragOrigin.current.x;
        let newStart = dragOrigin.current.start + delta;
        let newEnd = dragOrigin.current.end + delta;
        if (newStart < 0) { newEnd -= newStart; newStart = 0; }
        if (newEnd > 1) { newStart -= (newEnd - 1); newEnd = 1; }
        onChange?.(Math.max(0, newStart), Math.min(1, newEnd));
      }
    };

    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, regionStart, regionEnd, getPosition, onChange]);

  if (!buffer) return null;

  const duration = buffer.duration;
  const startTime = (regionStart * duration).toFixed(1);
  const endTime = (regionEnd * duration).toFixed(1);

  return (
    <div ref={containerRef} style={{ position: 'relative', userSelect: 'none' }}>
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        onMouseDown={handleMouseDown}
        style={{
          width: '100%', height, borderRadius: 3, cursor: dragging ? 'grabbing' : 'crosshair',
          background: theme.bg, border: `1px solid ${theme.panelBorder}33`,
        }}
      />
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 8, color: theme.textDim, marginTop: 2,
      }}>
        <span>{startTime}s</span>
        <span>{duration.toFixed(1)}s total</span>
        <span>{endTime}s</span>
      </div>
    </div>
  );
}
