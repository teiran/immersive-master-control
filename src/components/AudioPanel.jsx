import React, { useState, useRef } from 'react';
import { Panel, Slider, Btn, NumberInput } from './ui.jsx';
import { Waveform } from './Waveform.jsx';
import { SCENE_LINK_OPTIONS } from '../config.js';
import { theme, fonts } from '../theme.js';
import * as api from '../utils/api.js';

export function AudioPanel({
  masterVolume, setMasterVolume,
  tracks, setTracks,
  trackGroups, setTrackGroups, trackGroupsRef,
  audioEngine, groupController,
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

  // ─── Group helpers ────────────────────────────────────
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ label: '', type: 'loop', playMode: 'sequential' });
  const subFileInputRef = useRef(null);
  const subFileTargetRef = useRef(null); // { groupId, subId }

  const handleAddGroup = () => {
    if (!newGroup.label.trim()) return;
    setTrackGroups(prev => [...prev, {
      id: `group_${Date.now()}`, label: newGroup.label, type: newGroup.type,
      playMode: newGroup.playMode, color: randomColor(),
      customSequence: [], currentIndex: 0,
      triggerKey: null, sceneLink: null,
      volume: 80, muted: false, playing: false, speed: 100,
      subTracks: [],
    }]);
    setNewGroup({ label: '', type: 'loop', playMode: 'sequential' });
    setShowAddGroup(false);
  };

  const updateGroup = (groupId, updates) => {
    setTrackGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
  };

  const addSubTrack = (groupId) => {
    const subId = `sub_${Date.now()}`;
    setTrackGroups(prev => prev.map(g => g.id !== groupId ? g : {
      ...g,
      subTracks: [...g.subTracks, {
        id: subId, label: `Track ${g.subTracks.length + 1}`,
        fileName: null, serverPath: null, loaded: false, volume: 80, speed: 100,
      }],
    }));
    return subId;
  };

  const removeSubTrack = (groupId, subId) => {
    if (audioEngine) audioEngine.stopLayer(subId);
    setTrackGroups(prev => prev.map(g => g.id !== groupId ? g : {
      ...g,
      subTracks: g.subTracks.filter(s => s.id !== subId),
      customSequence: g.customSequence.filter(i => i < g.subTracks.length - 1),
    }));
  };

  const loadSubTrackFile = async (groupId, subId, file) => {
    if (!file || !file.type.startsWith('audio/')) return;
    const group = trackGroups.find(g => g.id === groupId);
    if (audioEngine) {
      await audioEngine.resume();
      await audioEngine.addLayerFromFile(subId, file, {
        loop: group?.type === 'loop', volume: 0.5, autoPlay: false,
      });
    }
    let serverPath = null;
    try {
      const result = await api.uploadAudio(file);
      serverPath = result.path;
    } catch (err) { console.warn('Upload failed:', err.message); }

    setTrackGroups(prev => prev.map(g => g.id !== groupId ? g : {
      ...g,
      subTracks: g.subTracks.map(s => s.id !== subId ? s : {
        ...s, fileName: file.name, loaded: true, serverPath,
      }),
    }));
  };

  const handleSubFilePicker = (groupId, subId) => {
    subFileTargetRef.current = { groupId, subId };
    subFileInputRef.current?.click();
  };

  const handleSubFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (file && subFileTargetRef.current) {
      loadSubTrackFile(subFileTargetRef.current.groupId, subFileTargetRef.current.subId, file);
    }
    e.target.value = '';
  };

  const handleGroupPlayStop = (group) => {
    if (!groupController) return;
    if (group.playing) {
      groupController.stopGroup(group);
      updateGroup(group.id, { playing: false });
    } else {
      groupController.startGroup(group);
      updateGroup(group.id, { playing: true });
    }
  };

  const handleGroupAdvance = (group) => {
    if (!groupController || !group.playing) return;
    groupController.advanceGroup(group);
  };

  const handleRemoveGroup = (groupId) => {
    const group = trackGroups.find(g => g.id === groupId);
    if (group && groupController) groupController.stopGroup(group);
    setTrackGroups(prev => prev.filter(g => g.id !== groupId));
    setEditingId(null);
  };

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
            audioEngine={audioEngine}
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

      {/* ─── TRACK GROUPS ──────────────────────────────── */}
      {trackGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            fontSize: 9, color: theme.textDim, letterSpacing: '0.1em',
            textTransform: 'uppercase', marginTop: 4,
          }}>
            Track Groups
          </div>
          {trackGroups.map(group => (
            <TrackGroupRow
              key={group.id}
              group={group}
              activeSubId={groupController?.getActiveSubTrackId(group.id)}
              isEditing={editingId === group.id}
              onEdit={() => setEditingId(editingId === group.id ? null : group.id)}
              onUpdate={(updates) => updateGroup(group.id, updates)}
              onPlayStop={() => handleGroupPlayStop(group)}
              onAdvance={() => handleGroupAdvance(group)}
              onTrigger={() => {
                if (groupController) {
                  groupController.triggerGroup(group);
                }
              }}
              onAddSubTrack={() => addSubTrack(group.id)}
              onRemoveSubTrack={(subId) => removeSubTrack(group.id, subId)}
              onSubFilePicker={(subId) => handleSubFilePicker(group.id, subId)}
              onSubDrop={(subId, e) => {
                e.preventDefault();
                const file = e.dataTransfer?.files[0];
                if (file) loadSubTrackFile(group.id, subId, file);
              }}
              onUpdateSubTrack={(subId, updates) => {
                setTrackGroups(prev => prev.map(g => g.id !== group.id ? g : {
                  ...g, subTracks: g.subTracks.map(s => s.id !== subId ? s : { ...s, ...updates }),
                }));
              }}
              onRemove={() => handleRemoveGroup(group.id)}
              dragOverId={dragOverId}
              setDragOverId={setDragOverId}
            />
          ))}
        </div>
      )}

      {/* Hidden file input for sub-tracks */}
      <input ref={subFileInputRef} type="file" accept="audio/*"
        style={{ display: 'none' }} onChange={handleSubFileSelected} />

      {/* ─── ADD TRACK / GROUP ────────────────────────────── */}
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
            <span style={{ color: theme.panelBorder }}>|</span>
            <button
              onClick={() => setShowAddGroup(true)}
              style={{
                background: 'transparent', border: 'none', color: theme.warn,
                fontFamily: fonts.mono, fontSize: 10, cursor: 'pointer',
              }}
            >
              + Add group
            </button>
          </div>
        )}

        {showAddGroup && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
            <input
              value={newGroup.label}
              onChange={e => setNewGroup(prev => ({ ...prev, label: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
              placeholder="Group name..."
              autoFocus
              style={{
                flex: 1, background: theme.bg, border: `1px solid ${theme.panelBorder}`,
                color: theme.text, padding: '4px 8px', borderRadius: 4,
                fontFamily: fonts.mono, fontSize: 10, outline: 'none',
              }}
            />
            <select value={newGroup.type}
              onChange={e => setNewGroup(prev => ({ ...prev, type: e.target.value }))}
              style={{ background: theme.bg, border: `1px solid ${theme.panelBorder}`,
                color: theme.text, padding: '4px 6px', borderRadius: 4, fontFamily: fonts.mono, fontSize: 10 }}>
              <option value="loop">Loop</option>
              <option value="trigger">Trigger</option>
            </select>
            <select value={newGroup.playMode}
              onChange={e => setNewGroup(prev => ({ ...prev, playMode: e.target.value }))}
              style={{ background: theme.bg, border: `1px solid ${theme.panelBorder}`,
                color: theme.text, padding: '4px 6px', borderRadius: 4, fontFamily: fonts.mono, fontSize: 10 }}>
              <option value="sequential">Sequential</option>
              <option value="random">Random</option>
              <option value="custom">Custom</option>
            </select>
            <Btn small onClick={handleAddGroup} active color={theme.warn}>Add</Btn>
            <Btn small onClick={() => setShowAddGroup(false)} color={theme.textDim}>X</Btn>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─── TRACK ROW (loop layers) ─────────────────────────────────

function TrackRow({
  track, audioEngine, isDragOver, isEditing,
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Slider
            value={track.volume}
            onChange={onVolumeChange}
            color={track.color}
            showValue
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, color: theme.textDim, minWidth: 18 }}>spd</span>
            <div style={{ flex: 1 }}>
              <Slider
                value={track.speed ?? 100}
                onChange={(v) => onUpdate({ speed: v })}
                min={25} max={200}
                color={theme.textDim}
                showValue
              />
            </div>
          </div>
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
          {/* Waveform region selector */}
          {track.loaded && audioEngine && (
            <div style={{ padding: '4px 0', borderTop: `1px solid ${theme.panelBorder}33` }}>
              <span style={{ fontSize: 9, color: theme.textDim, display: 'block', marginBottom: 4 }}>
                Play region — drag handles to trim
              </span>
              <Waveform
                buffer={audioEngine.getBuffer(track.id)}
                regionStart={track.regionStart ?? 0}
                regionEnd={track.regionEnd ?? 1}
                color={track.color}
                onChange={(start, end) => {
                  onUpdate({ regionStart: start, regionEnd: end });
                  const buf = audioEngine.getBuffer(track.id);
                  if (buf) {
                    audioEngine.setLayerRegion(track.id, start * buf.duration, end * buf.duration);
                  }
                }}
              />
            </div>
          )}

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

          {/* Auto-speed */}
          <div style={{
            padding: '6px 0', borderTop: `1px solid ${theme.panelBorder}33`,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!track.autoSpeed}
                onChange={e => onUpdate({ autoSpeed: e.target.checked })}
              />
              <span style={{ fontSize: 9, color: theme.textDim }}>
                Auto-speed — smooth speed drift
              </span>
            </label>
            {track.autoSpeed && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <NumberInput label="Min %" value={track.autoSpeedMin ?? 80}
                    onChange={v => onUpdate({ autoSpeedMin: v })} min={25} max={200} />
                  <NumberInput label="Max %" value={track.autoSpeedMax ?? 120}
                    onChange={v => onUpdate({ autoSpeedMax: v })} min={25} max={200} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!track.autoSpeedRandom}
                    onChange={e => onUpdate({ autoSpeedRandom: e.target.checked })}
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

// ─── TRACK GROUP ROW ─────────────────────────────────────────

function TrackGroupRow({
  group, activeSubId, isEditing,
  onEdit, onUpdate, onPlayStop, onAdvance, onTrigger,
  onAddSubTrack, onRemoveSubTrack, onSubFilePicker, onSubDrop, onUpdateSubTrack,
  onRemove, dragOverId, setDragOverId,
}) {
  const [expanded, setExpanded] = useState(false);
  const modeBadge = { random: 'RND', sequential: 'SEQ', custom: 'CUS' }[group.playMode] || '?';
  const hasLoadedSubs = group.subTracks.some(s => s.loaded);

  return (
    <div style={{
      background: theme.bg + '88', borderRadius: 6,
      border: `1px solid ${group.color}33`, overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
        cursor: 'pointer',
      }} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: 8, color: theme.textDim }}>{expanded ? '▼' : '▶'}</span>

        {group.type === 'loop' ? (
          <>
            <button onClick={(e) => { e.stopPropagation(); onPlayStop(); }} disabled={!hasLoadedSubs} style={{
              background: group.playing ? group.color + '22' : 'transparent',
              border: `1px solid ${group.playing ? group.color : theme.panelBorder}`,
              color: group.playing ? group.color : theme.textDim,
              padding: '2px 5px', borderRadius: 3, fontFamily: fonts.mono,
              fontSize: 9, cursor: hasLoadedSubs ? 'pointer' : 'default', minWidth: 20,
              opacity: hasLoadedSubs ? 1 : 0.3,
            }}>
              {group.playing ? '■' : '▶'}
            </button>
            {group.playing && (
              <button onClick={(e) => { e.stopPropagation(); onAdvance(); }} style={{
                background: group.color + '22', border: `1px solid ${group.color}44`,
                color: group.color, padding: '2px 5px', borderRadius: 3,
                fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer',
              }}>⏭</button>
            )}
          </>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onTrigger(); }} disabled={!hasLoadedSubs} style={{
            background: 'transparent', border: `1px solid ${theme.panelBorder}`,
            color: hasLoadedSubs ? theme.accent : theme.textDim,
            padding: '2px 5px', borderRadius: 3, fontFamily: fonts.mono,
            fontSize: 9, cursor: hasLoadedSubs ? 'pointer' : 'default', minWidth: 20,
          }}>
            ⚡
          </button>
        )}

        <button onClick={(e) => { e.stopPropagation(); onUpdate({ muted: !group.muted }); }} style={{
          background: group.muted ? theme.danger + '33' : 'transparent',
          border: `1px solid ${group.muted ? theme.danger : theme.panelBorder}`,
          color: group.muted ? theme.danger : theme.textDim,
          padding: '2px 5px', borderRadius: 3, fontFamily: fonts.mono,
          fontSize: 9, cursor: 'pointer', minWidth: 20,
        }}>M</button>

        <div style={{ width: 6, height: 6, borderRadius: '50%', background: group.color, flexShrink: 0 }} />

        <span style={{ fontSize: 10, color: theme.text, flex: 1 }}>
          {group.label}
          <span style={{
            fontSize: 8, color: group.color, marginLeft: 6,
            background: group.color + '22', padding: '1px 4px', borderRadius: 3,
          }}>{modeBadge}</span>
          <span style={{ fontSize: 8, color: theme.textDim, marginLeft: 4 }}>
            ({group.subTracks.length} tracks)
          </span>
          {group.playing && group.subTracks.length > 0 && (() => {
            const activeSub = group.subTracks.find(s => s.id === activeSubId);
            return activeSub ? (
              <span style={{ fontSize: 8, color: group.color, marginLeft: 6 }}>
                — #{group.subTracks.indexOf(activeSub) + 1} {activeSub.label}
              </span>
            ) : null;
          })()}
        </span>

        <div style={{ width: 120 }}>
          <Slider value={group.volume} onChange={v => onUpdate({ volume: v })} color={group.color} showValue />
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Play mode selector */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: theme.textDim }}>Mode:</span>
            {['sequential', 'random', 'custom'].map(mode => (
              <button key={mode} onClick={() => onUpdate({ playMode: mode })} style={{
                background: group.playMode === mode ? group.color + '22' : 'transparent',
                border: `1px solid ${group.playMode === mode ? group.color : theme.panelBorder}`,
                color: group.playMode === mode ? group.color : theme.textDim,
                padding: '2px 8px', borderRadius: 3, fontFamily: fonts.mono,
                fontSize: 9, cursor: 'pointer', textTransform: 'capitalize',
              }}>{mode}</button>
            ))}
            {group.triggerKey && (
              <span style={{ fontSize: 8, color: theme.textDim, marginLeft: 8 }}>
                Key: [{group.triggerKey}]
              </span>
            )}
          </div>

          {/* Auto-advance timer */}
          <div style={{
            padding: '4px 0', borderBottom: `1px solid ${theme.panelBorder}22`,
            marginBottom: 4,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!group.autoAdvance}
                onChange={e => onUpdate({ autoAdvance: e.target.checked })} />
              <span style={{ fontSize: 9, color: theme.textDim }}>
                Auto-advance — switch track every
              </span>
            </label>
            {group.autoAdvance && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!group.autoAdvanceRandom}
                    onChange={e => onUpdate({ autoAdvanceRandom: e.target.checked })} />
                  <span style={{ fontSize: 9, color: theme.textDim }}>Random interval</span>
                </label>
                {group.autoAdvanceRandom ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <NumberInput label="Min s" value={((group.autoAdvanceMin ?? 5000) / 1000)}
                      onChange={v => onUpdate({ autoAdvanceMin: v * 1000 })} min={0.5} max={300} step={0.5} />
                    <NumberInput label="Max s" value={((group.autoAdvanceMax ?? 15000) / 1000)}
                      onChange={v => onUpdate({ autoAdvanceMax: v * 1000 })} min={0.5} max={300} step={0.5} />
                  </div>
                ) : (
                  <NumberInput label="Every s" value={((group.autoAdvanceInterval ?? 10000) / 1000)}
                    onChange={v => onUpdate({ autoAdvanceInterval: v * 1000 })} min={0.5} max={300} step={0.5} />
                )}
              </div>
            )}
          </div>

          {/* Sub-tracks */}
          {group.subTracks.map((sub, idx) => {
            const isActive = group.playing && activeSubId === sub.id;
            return (
            <div key={sub.id}
              onDrop={(e) => onSubDrop(sub.id, e)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(sub.id); }}
              onDragLeave={() => setDragOverId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                borderRadius: 4,
                background: isActive ? group.color + '18'
                  : dragOverId === sub.id ? group.color + '22' : 'transparent',
                border: isActive ? `1px solid ${group.color}66` : '1px solid transparent',
                outline: dragOverId === sub.id ? `1px dashed ${group.color}` : 'none',
                transition: 'all 0.3s',
              }}
            >
              <span style={{
                fontSize: 9, minWidth: 18, fontFamily: fonts.mono,
                color: isActive ? group.color : theme.textDim,
                fontWeight: isActive ? 700 : 400,
              }}>#{idx + 1}</span>
              {isActive && <span style={{
                width: 6, height: 6, borderRadius: '50%', background: group.color,
                boxShadow: `0 0 6px ${group.color}88`, flexShrink: 0,
              }} />}
              <div style={{ minWidth: 80, flex: 1 }}>
                <span style={{
                  fontSize: 10, display: 'block',
                  color: isActive ? group.color : theme.text,
                  fontWeight: isActive ? 600 : 400,
                }}>{sub.label}</span>
                {sub.loaded ? (
                  <span style={{ fontSize: 8, color: theme.textDim }}>{sub.fileName}</span>
                ) : (
                  <span style={{ fontSize: 8, color: theme.warn }}>no audio</span>
                )}
              </div>
              {!sub.loaded && (
                <button onClick={() => onSubFilePicker(sub.id)} style={{
                  background: theme.accent + '22', border: `1px solid ${theme.accent}44`,
                  color: theme.accent, padding: '2px 6px', borderRadius: 3,
                  fontFamily: fonts.mono, fontSize: 8, cursor: 'pointer',
                }}>Load</button>
              )}
              <div style={{ flex: 1 }}>
                <Slider value={sub.volume} onChange={v => onUpdateSubTrack(sub.id, { volume: v })}
                  color={group.color} showValue />
              </div>
              <div style={{ width: 80 }}>
                <Slider value={sub.speed ?? 100} onChange={v => onUpdateSubTrack(sub.id, { speed: v })}
                  min={25} max={200} color={theme.textDim} showValue />
              </div>
              <button onClick={() => onRemoveSubTrack(sub.id)} style={{
                background: 'transparent', border: 'none', color: theme.danger,
                cursor: 'pointer', fontSize: 12, padding: '0 4px',
              }}>×</button>
            </div>
            );
          })}

          {/* Custom sequence editor */}
          {group.playMode === 'custom' && (
            <div style={{ padding: '4px 0', borderTop: `1px solid ${theme.panelBorder}33` }}>
              <span style={{ fontSize: 9, color: theme.textDim, display: 'block', marginBottom: 4 }}>
                Play order (click to add, click badge to remove):
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {(group.customSequence || []).map((subIdx, seqPos) => {
                  const isCurrent = group.playing && seqPos === (group.currentIndex ?? -1);
                  return (
                  <button key={seqPos}
                    onClick={() => onUpdate({
                      customSequence: group.customSequence.filter((_, i) => i !== seqPos),
                    })}
                    style={{
                      background: isCurrent ? group.color + '55' : group.color + '22',
                      border: `1px solid ${isCurrent ? group.color : group.color + '44'}`,
                      color: isCurrent ? theme.text : group.color,
                      padding: '2px 6px', borderRadius: 3,
                      fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer',
                      fontWeight: isCurrent ? 700 : 400,
                      boxShadow: isCurrent ? `0 0 6px ${group.color}66` : 'none',
                    }}
                  >#{subIdx + 1}</button>
                  );
                })}
                <span style={{ color: theme.textDim, fontSize: 9 }}>+</span>
                {group.subTracks.map((_, idx) => (
                  <button key={idx}
                    onClick={() => onUpdate({
                      customSequence: [...(group.customSequence || []), idx],
                    })}
                    style={{
                      background: 'transparent', border: `1px solid ${theme.panelBorder}`,
                      color: theme.textDim, padding: '1px 5px', borderRadius: 3,
                      fontFamily: fonts.mono, fontSize: 8, cursor: 'pointer',
                    }}
                  >#{idx + 1}</button>
                ))}
              </div>
            </div>
          )}

          {/* Add sub-track + settings */}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button onClick={onAddSubTrack} style={{
              background: group.color + '22', border: `1px solid ${group.color}44`,
              color: group.color, padding: '3px 10px', borderRadius: 3,
              fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer',
            }}>+ Add sub-track</button>
            <button onClick={onEdit} style={{
              background: 'transparent', border: `1px solid ${theme.panelBorder}`,
              color: theme.textDim, padding: '3px 10px', borderRadius: 3,
              fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer',
            }}>Settings</button>
            <div style={{ flex: 1 }} />
            <button onClick={onRemove} style={{
              background: theme.danger + '22', border: `1px solid ${theme.danger}44`,
              color: theme.danger, padding: '3px 10px', borderRadius: 3,
              fontFamily: fonts.mono, fontSize: 9, cursor: 'pointer',
            }}>Remove group</button>
          </div>

          {/* Settings panel */}
          {isEditing && (
            <div style={{
              padding: '8px', marginTop: 4, background: theme.panel,
              borderRadius: 4, border: `1px solid ${theme.panelBorder}`,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: theme.textDim, minWidth: 50 }}>Name:</span>
                <input value={group.label} onChange={e => onUpdate({ label: e.target.value })}
                  style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.panelBorder}`,
                    color: theme.text, padding: '3px 6px', borderRadius: 3,
                    fontFamily: fonts.mono, fontSize: 10, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: theme.textDim, minWidth: 50 }}>Key:</span>
                <input value={group.triggerKey || ''} maxLength={1}
                  onChange={e => onUpdate({ triggerKey: e.target.value.toUpperCase() || null })}
                  placeholder="Press key..."
                  style={{ width: 50, background: theme.bg, border: `1px solid ${theme.panelBorder}`,
                    color: theme.text, padding: '3px 6px', borderRadius: 3,
                    fontFamily: fonts.mono, fontSize: 10, outline: 'none', textAlign: 'center' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: theme.textDim, minWidth: 50 }}>Auto:</span>
                <select value={group.sceneLink || ''}
                  onChange={e => onUpdate({ sceneLink: e.target.value || null })}
                  style={{ flex: 1, background: theme.bg, border: `1px solid ${theme.panelBorder}`,
                    color: theme.text, padding: '3px 6px', borderRadius: 3,
                    fontFamily: fonts.mono, fontSize: 10 }}>
                  {SCENE_LINK_OPTIONS.map(o => (
                    <option key={o.value || 'none'} value={o.value || ''}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function randomColor() {
  const colors = ['#4a7c59', '#c474a0', '#7ca5b8', '#3d8bbd', '#b89b4a',
    '#8b8b9e', '#6b8e4e', '#c4a35a', '#9e5a5a', '#5a9e7c'];
  return colors[Math.floor(Math.random() * colors.length)];
}
