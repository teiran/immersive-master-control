import React, { useState, useRef } from 'react';
import { Panel, Slider, Btn } from './ui.jsx';
import { SCENE_LINK_OPTIONS } from '../config.js';
import { theme, fonts } from '../theme.js';
import * as api from '../utils/api.js';

export function AudioPanel({
  masterVolume, setMasterVolume,
  tracks, setTracks,
  audioEngine,
  onTriggerTrack,
}) {
  const [dragOverId, setDragOverId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [newTrack, setNewTrack] = useState({ label: '', type: 'loop' });
  const [assigningKey, setAssigningKey] = useState(null);
  const fileInputRef = useRef(null);
  const fileTargetRef = useRef(null); // which track the file picker is for

  // ─── Load audio file into a track ─────────────────────
  const loadFileToTrack = async (trackId, file) => {
    if (!file || !file.type.startsWith('audio/')) return;

    const track = tracks.find(t => t.id === trackId);
    if (audioEngine) {
      await audioEngine.resume();
      await audioEngine.addLayerFromFile(trackId, file, {
        loop: track.type === 'loop',
        volume: (track.volume ?? 50) / 100,
      });
    }

    // Upload to server for persistence
    let serverPath = null;
    try {
      const result = await api.uploadAudio(file);
      serverPath = result.path;
    } catch (err) {
      console.warn('Audio upload failed:', err.message);
    }

    setTracks(prev => prev.map(t =>
      t.id === trackId ? { ...t, fileName: file.name, loaded: true, serverPath } : t
    ));
  };

  // ─── Drop handler ─────────────────────────────────────
  const handleDrop = (e, trackId) => {
    e.preventDefault();
    setDragOverId(null);
    loadFileToTrack(trackId, e.dataTransfer.files[0]);
  };

  // ─── File picker for a specific track ─────────────────
  const openFilePicker = (trackId) => {
    fileTargetRef.current = trackId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (file && fileTargetRef.current) {
      loadFileToTrack(fileTargetRef.current, file);
    }
    e.target.value = ''; // reset so same file can be picked again
  };

  // ─── Drop file to create a new track ──────────────────
  const handleDropNew = async (e) => {
    e.preventDefault();
    setDragOverId(null);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('audio/')) return;
    await createTrackFromFile(file, 'loop');
  };

  const createTrackFromFile = async (file, type) => {
    const id = `track_${Date.now()}`;
    const label = file.name.replace(/\.[^.]+$/, '');

    let serverPath = null;
    try {
      const result = await api.uploadAudio(file);
      serverPath = result.path;
    } catch (err) {
      console.warn('Audio upload failed:', err.message);
    }

    const track = {
      id, label, type, color: randomColor(),
      sceneLink: null, triggerKey: null,
      volume: 50, muted: false, fileName: file.name, loaded: true, serverPath,
    };
    setTracks(prev => [...prev, track]);
    if (audioEngine) {
      await audioEngine.resume();
      await audioEngine.addLayerFromFile(id, file, { loop: type === 'loop', volume: 0.5 });
    }
  };

  // ─── Add track manually ───────────────────────────────
  const handleAddTrack = () => {
    if (!newTrack.label.trim()) return;
    const id = `track_${Date.now()}`;
    setTracks(prev => [...prev, {
      id, label: newTrack.label, type: newTrack.type, color: randomColor(),
      sceneLink: null, triggerKey: null,
      volume: 50, muted: false, fileName: null, loaded: false,
    }]);
    setNewTrack({ label: '', type: 'loop' });
    setShowAddTrack(false);
  };

  // ─── Add new track via file picker ────────────────────
  const addNewFileRef = useRef(null);
  const handleAddNewFile = (e) => {
    const file = e.target.files?.[0];
    if (file) createTrackFromFile(file, 'loop');
    e.target.value = '';
  };

  const handleRemoveTrack = (id) => {
    if (audioEngine) audioEngine.stopLayer(id);
    setTracks(prev => prev.filter(t => t.id !== id));
    setEditingId(null);
  };

  const updateTrack = (id, updates) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleKeyAssign = (e) => {
    if (!assigningKey) return;
    e.preventDefault();
    updateTrack(assigningKey, { triggerKey: e.key.toUpperCase() });
    setAssigningKey(null);
  };

  const loopTracks = tracks.filter(t => t.type === 'loop');
  const triggerTracks = tracks.filter(t => t.type === 'trigger');

  return (
    <Panel title="Audio Engine" icon="🎵" status="connected">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="audio/*"
        style={{ display: 'none' }} onChange={handleFileSelected} />
      <input ref={addNewFileRef} type="file" accept="audio/*"
        style={{ display: 'none' }} onChange={handleAddNewFile} />

      {/* Master Volume */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
        background: theme.accentDim + '44', borderRadius: 6,
        border: `1px solid ${theme.accent}22`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: theme.accent, minWidth: 50 }}>
          MASTER
        </span>
        <Slider value={masterVolume} onChange={setMasterVolume} color={theme.accent} />
      </div>

      {/* ─── LOOP TRACKS ──────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          fontSize: 9, color: theme.textDim, letterSpacing: '0.1em',
          textTransform: 'uppercase', marginTop: 4,
        }}>
          Layers
        </div>

        {loopTracks.map(track => (
          <TrackRow
            key={track.id}
            track={track}
            isDragOver={dragOverId === track.id}
            isEditing={editingId === track.id}
            onDrop={(e) => handleDrop(e, track.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(track.id); }}
            onDragLeave={() => setDragOverId(null)}
            onVolumeChange={(v) => updateTrack(track.id, { volume: v })}
            onMuteToggle={() => updateTrack(track.id, { muted: !track.muted })}
            onPlayStop={() => {
              if (!track.loaded || !audioEngine) return;
              const layer = audioEngine.layers.get(track.id);
              if (layer?.playing) {
                audioEngine.stopLayer(track.id);
                updateTrack(track.id, { playing: false });
              } else {
                audioEngine.resume();
                audioEngine.playLayer(track.id);
                updateTrack(track.id, { playing: true });
              }
            }}
            onEdit={() => setEditingId(editingId === track.id ? null : track.id)}
            onSceneLinkChange={(link) => updateTrack(track.id, { sceneLink: link })}
            onUpdate={(updates) => updateTrack(track.id, updates)}
            onRemove={() => handleRemoveTrack(track.id)}
            onLabelChange={(label) => updateTrack(track.id, { label })}
            onBrowse={() => openFilePicker(track.id)}
          />
        ))}
      </div>

      {/* ─── TRIGGER TRACKS ───────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          fontSize: 9, color: theme.textDim, letterSpacing: '0.1em',
          textTransform: 'uppercase', marginTop: 4,
        }}>
          Triggers — one-shot effects
        </div>

        {triggerTracks.length === 0 && (
          <div style={{ fontSize: 10, color: theme.textDim, padding: '4px 0' }}>
            No triggers yet — add one below
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
          onKeyDown={handleKeyAssign} tabIndex={-1}
        >
          {triggerTracks.map(track => (
            <TriggerButton
              key={track.id}
              track={track}
              loopTracks={loopTracks}
              isDragOver={dragOverId === track.id}
              isEditing={editingId === track.id}
              onDrop={(e) => handleDrop(e, track.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(track.id); }}
              onDragLeave={() => setDragOverId(null)}
              onTrigger={() => onTriggerTrack(track)}
              onEdit={() => setEditingId(editingId === track.id ? null : track.id)}
              onRemove={() => handleRemoveTrack(track.id)}
              onUpdate={(updates) => updateTrack(track.id, updates)}
              onLabelChange={(label) => updateTrack(track.id, { label })}
              onAssignKey={() => setAssigningKey(track.id)}
              onKeyDown={handleKeyAssign}
              onBrowse={() => openFilePicker(track.id)}
            />
          ))}
        </div>
      </div>

      {/* ─── ADD TRACK ────────────────────────────────── */}
      <div
        onDrop={handleDropNew}
        onDragOver={(e) => { e.preventDefault(); setDragOverId('__new'); }}
        onDragLeave={() => setDragOverId(null)}
        style={{
          border: `2px dashed ${dragOverId === '__new' ? theme.accent : theme.panelBorder}`,
          borderRadius: 6, padding: '8px 12px',
          background: dragOverId === '__new' ? theme.accent + '11' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        {showAddTrack ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              value={newTrack.label}
              onChange={e => setNewTrack(prev => ({ ...prev, label: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAddTrack()}
              placeholder="Track name..."
              autoFocus
              style={{
                flex: 1, background: theme.bg, border: `1px solid ${theme.panelBorder}`,
                color: theme.text, padding: '4px 8px', borderRadius: 4,
                fontFamily: fonts.mono, fontSize: 10, outline: 'none',
              }}
            />
            <select
              value={newTrack.type}
              onChange={e => setNewTrack(prev => ({ ...prev, type: e.target.value }))}
              style={{
                background: theme.bg, border: `1px solid ${theme.panelBorder}`,
                color: theme.text, padding: '4px 6px', borderRadius: 4,
                fontFamily: fonts.mono, fontSize: 10,
              }}
            >
              <option value="loop">Loop</option>
              <option value="trigger">Trigger</option>
            </select>
            <Btn small onClick={handleAddTrack} active color={theme.accent}>Add</Btn>
            <Btn small onClick={() => setShowAddTrack(false)} color={theme.textDim}>X</Btn>
          </div>
        ) : (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center',
          }}>
            <button
              onClick={() => setShowAddTrack(true)}
              style={{
                background: 'transparent', border: 'none', color: theme.textDim,
                fontFamily: fonts.mono, fontSize: 10, cursor: 'pointer',
              }}
            >
              + Add empty track
            </button>
            <span style={{ color: theme.panelBorder }}>|</span>
            <button
              onClick={() => addNewFileRef.current?.click()}
              style={{
                background: 'transparent', border: 'none', color: theme.accent,
                fontFamily: fonts.mono, fontSize: 10, cursor: 'pointer',
              }}
            >
              Browse audio file
            </button>
            <span style={{ color: theme.panelBorder }}>|</span>
            <span style={{ fontSize: 9, color: theme.textDim }}>
              or drop file here
            </span>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─── TRACK ROW (loop layers) ─────────────────────────────────

function TrackRow({
  track, isDragOver, isEditing,
  onDrop, onDragOver, onDragLeave,
  onVolumeChange, onMuteToggle, onPlayStop, onEdit,
  onSceneLinkChange, onUpdate, onRemove, onLabelChange, onBrowse,
}) {
  const isPlaying = track.playing !== false && track.loaded;

  return (
    <div>
      <div
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          opacity: track.muted ? 0.35 : 1,
          transition: 'all 0.2s', padding: '2px 4px', borderRadius: 4,
          background: isDragOver ? track.color + '22' : 'transparent',
          outline: isDragOver ? `2px dashed ${track.color}` : 'none',
        }}
      >
        {/* Play / Stop */}
        <button onClick={onPlayStop} style={{
          background: isPlaying ? track.color + '22' : 'transparent',
          border: `1px solid ${isPlaying ? track.color : theme.panelBorder}`,
          color: isPlaying ? track.color : theme.textDim,
          padding: '2px 5px', borderRadius: 3, fontFamily: fonts.mono,
          fontSize: 9, cursor: track.loaded ? 'pointer' : 'default', minWidth: 20,
          opacity: track.loaded ? 1 : 0.3,
        }} disabled={!track.loaded}>
          {isPlaying ? '■' : '▶'}
        </button>
        {/* Mute */}
        <button onClick={onMuteToggle} style={{
          background: track.muted ? theme.danger + '33' : 'transparent',
          border: `1px solid ${track.muted ? theme.danger : theme.panelBorder}`,
          color: track.muted ? theme.danger : theme.textDim,
          padding: '2px 5px', borderRadius: 3, fontFamily: fonts.mono,
          fontSize: 9, cursor: 'pointer', minWidth: 20,
        }}>
          M
        </button>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: track.loaded ? track.color : theme.textDim + '44',
          flexShrink: 0,
        }} />
        <div style={{ minWidth: 100, cursor: 'pointer' }} onClick={onEdit}>
          <span style={{ fontSize: 10, color: theme.text, display: 'block' }}>
            {track.label}
          </span>
          {track.loaded ? (
            <span style={{ fontSize: 8, color: theme.textDim, display: 'block' }}>
              {track.fileName}
            </span>
          ) : (
            <span style={{ fontSize: 8, color: theme.warn, display: 'block' }}>
              no audio loaded
            </span>
          )}
          {track.sceneLink && (
            <span style={{ fontSize: 8, color: track.color, display: 'block' }}>
              ↔ {SCENE_LINK_OPTIONS.find(o => o.value === track.sceneLink)?.label}
            </span>
          )}
        </div>
        {!track.loaded && (
          <button onClick={onBrowse} style={{
            background: theme.accent + '22', border: `1px solid ${theme.accent}44`,
            color: theme.accent, padding: '3px 8px', borderRadius: 3,
            fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            Load file
          </button>
        )}
        <div style={{ flex: 1 }}>
          <Slider
            value={track.volume}
            onChange={onVolumeChange}
            color={track.color}
            showValue
          />
        </div>
      </div>

      {isEditing && (
        <div style={{
          padding: '8px 12px', marginLeft: 30, marginTop: 2, marginBottom: 4,
          background: theme.bg, borderRadius: 4, border: `1px solid ${theme.panelBorder}`,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: theme.textDim, minWidth: 50 }}>Name:</span>
            <input
              value={track.label}
              onChange={e => onLabelChange(e.target.value)}
              style={{
                flex: 1, background: theme.panel, border: `1px solid ${theme.panelBorder}`,
                color: theme.text, padding: '3px 6px', borderRadius: 3,
                fontFamily: fonts.mono, fontSize: 10, outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: theme.textDim, minWidth: 50 }}>Auto:</span>
            <select
              value={track.sceneLink || ''}
              onChange={e => onSceneLinkChange(e.target.value || null)}
              style={{
                flex: 1, background: theme.panel, border: `1px solid ${theme.panelBorder}`,
                color: theme.text, padding: '3px 6px', borderRadius: 3,
                fontFamily: fonts.mono, fontSize: 10,
              }}
            >
              {SCENE_LINK_OPTIONS.map(o => (
                <option key={o.value || 'none'} value={o.value || ''}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* Auto-dim */}
          <div style={{
            padding: '6px 0', borderTop: `1px solid ${theme.panelBorder}33`,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!track.autoDim}
                onChange={e => onUpdate({ autoDim: e.target.checked })}
              />
              <span style={{ fontSize: 9, color: theme.textDim }}>
                Auto-dim — smooth drift up/down
              </span>
            </label>
            {track.autoDim && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <NumberInput label="Min %" value={track.autoDimMin ?? 10}
                    onChange={v => onUpdate({ autoDimMin: v })} />
                  <NumberInput label="Max %" value={track.autoDimMax ?? 80}
                    onChange={v => onUpdate({ autoDimMax: v })} />
                  <NumberInput label="Step ms" value={track.autoDimSpeed ?? 200}
                    onChange={v => onUpdate({ autoDimSpeed: v })} min={50} max={2000} step={50} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!track.autoDimRandom}
                    onChange={e => onUpdate({ autoDimRandom: e.target.checked })}
                  />
                  <span style={{ fontSize: 9, color: theme.textDim }}>
                    Random direction changes
                  </span>
                </label>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
            <button onClick={onBrowse} style={{
              background: theme.accent + '22', border: `1px solid ${theme.accent}44`,
              color: theme.accent, padding: '3px 10px', borderRadius: 3,
              fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer',
            }}>
              {track.loaded ? 'Replace audio' : 'Load audio file'}
            </button>
            <button onClick={onRemove} style={{
              background: theme.danger + '22', border: `1px solid ${theme.danger}44`,
              color: theme.danger, padding: '3px 10px', borderRadius: 3,
              fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer',
            }}>
              Remove track
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TRIGGER BUTTON (one-shot effects) ───────────────────────

function TriggerButton({
  track, loopTracks, isDragOver, isEditing,
  onDrop, onDragOver, onDragLeave,
  onTrigger, onEdit, onRemove, onUpdate, onLabelChange, onAssignKey, onKeyDown, onBrowse,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <button
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        onClick={track.loaded ? onTrigger : onBrowse}
        onContextMenu={(e) => { e.preventDefault(); onEdit(); }}
        style={{
          background: isDragOver ? theme.accent + '22' : track.loaded ? theme.bg : theme.panel,
          border: `1px solid ${isDragOver ? theme.accent : track.loaded ? theme.panelBorder : theme.panelBorder + '66'}`,
          color: track.loaded ? theme.text : theme.textDim,
          padding: '8px 14px', borderRadius: 6, fontFamily: fonts.mono,
          fontSize: 11, cursor: 'pointer', minWidth: 80, textAlign: 'center',
          transition: 'all 0.15s',
          outline: isDragOver ? `2px dashed ${theme.accent}` : 'none',
        }}
      >
        <div>{track.label}</div>
        {track.triggerKey && (
          <span style={{ fontSize: 8, color: theme.textDim }}>[{track.triggerKey}]</span>
        )}
        {!track.loaded && (
          <div style={{ fontSize: 8, color: theme.warn, marginTop: 2 }}>click to load</div>
        )}
      </button>

      {isEditing && (
        <div style={{
          padding: '6px 8px', background: theme.bg, borderRadius: 4,
          border: `1px solid ${theme.panelBorder}`,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <input
            value={track.label}
            onChange={e => onLabelChange(e.target.value)}
            style={{
              background: theme.panel, border: `1px solid ${theme.panelBorder}`,
              color: theme.text, padding: '3px 6px', borderRadius: 3,
              fontFamily: fonts.mono, fontSize: 10, outline: 'none', width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <button onClick={onBrowse} style={{
            background: theme.accent + '22', border: `1px solid ${theme.accent}44`,
            color: theme.accent, padding: '3px 6px', borderRadius: 3,
            fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer', width: '100%',
          }}>
            {track.loaded ? 'Replace audio' : 'Load audio file'}
          </button>
          <button
            onClick={onAssignKey}
            onKeyDown={onKeyDown}
            style={{
              background: theme.panel, border: `1px solid ${theme.panelBorder}`,
              color: theme.accent, padding: '3px 6px', borderRadius: 3,
              fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer', width: '100%',
            }}
          >
            {track.triggerKey ? `Key: [${track.triggerKey}] — click to change` : 'Assign key...'}
          </button>
          {/* Intensify target */}
          <div style={{ borderTop: `1px solid ${theme.panelBorder}33`, paddingTop: 4 }}>
            <span style={{ fontSize: 8, color: theme.textDim, display: 'block', marginBottom: 3 }}>
              Intensify a layer when triggered:
            </span>
            <select
              value={track.intensifyTarget || ''}
              onChange={e => onUpdate({ intensifyTarget: e.target.value || null })}
              style={{
                width: '100%', background: theme.panel, border: `1px solid ${theme.panelBorder}`,
                color: theme.text, padding: '3px 6px', borderRadius: 3,
                fontFamily: fonts.mono, fontSize: 9, boxSizing: 'border-box',
              }}
            >
              <option value="">None</option>
              {loopTracks.map(lt => (
                <option key={lt.id} value={lt.id}>{lt.label}</option>
              ))}
            </select>
            {track.intensifyTarget && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <NumberInput label="+%" value={track.intensifyAmount ?? 20}
                  onChange={v => onUpdate({ intensifyAmount: v })} />
                <NumberInput label="Fade ms" value={track.intensifyDuration ?? 3000}
                  onChange={v => onUpdate({ intensifyDuration: v })} min={500} max={30000} step={500} />
              </div>
            )}
          </div>
          <button onClick={onRemove} style={{
            background: theme.danger + '22', border: `1px solid ${theme.danger}44`,
            color: theme.danger, padding: '3px 6px', borderRadius: 3,
            fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer',
          }}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function NumberInput({ label, value, onChange, min = 0, max = 100, step = 1 }) {
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

function randomColor() {
  const colors = ['#4a7c59', '#c474a0', '#7ca5b8', '#3d8bbd', '#b89b4a',
    '#8b8b9e', '#6b8e4e', '#c4a35a', '#9e5a5a', '#5a9e7c'];
  return colors[Math.floor(Math.random() * colors.length)];
}
