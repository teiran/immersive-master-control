import React, { useState } from 'react';
import { Panel, Slider, Btn } from './ui.jsx';
import { AUDIO_LAYERS, SFX_TRIGGERS } from '../config.js';
import { theme, fonts } from '../theme.js';

export function AudioPanel({
  masterVolume, setMasterVolume,
  audioLevels, setAudioLevels,
  audioMutes, setAudioMutes,
  motorwayAuto, setMotorwayAuto,
  sfxActive, onTriggerSfx,
  audioEngine,
  layerFiles, setLayerFiles,
}) {
  const [dragOverLayer, setDragOverLayer] = useState(null);

  const handleDrop = async (e, layerId) => {
    e.preventDefault();
    setDragOverLayer(null);

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('audio/')) return;

    if (audioEngine) {
      await audioEngine.addLayerFromFile(layerId, file, {
        volume: audioLevels[layerId] ?? 0.5,
      });
      setLayerFiles(prev => ({ ...prev, [layerId]: file.name }));
    }
  };

  const handleDragOver = (e, layerId) => {
    e.preventDefault();
    setDragOverLayer(layerId);
  };

  const handleDragLeave = () => {
    setDragOverLayer(null);
  };

  return (
    <Panel title="Audio Engine" icon="🎵" status="connected">
      {/* Master Volume */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
        background: theme.accentDim + '44', borderRadius: 6,
        border: `1px solid ${theme.accent}22`,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: theme.accent, minWidth: 50,
        }}>
          MASTER
        </span>
        <Slider value={masterVolume} onChange={setMasterVolume} color={theme.accent} />
      </div>

      {/* Audio Layers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          fontSize: 9, color: theme.textDim, letterSpacing: '0.1em',
          textTransform: 'uppercase', marginTop: 4,
        }}>
          Environment Layers — drop audio files onto any layer
        </div>

        {AUDIO_LAYERS.map(layer => {
          const isDragOver = dragOverLayer === layer.id;
          const hasFile = !!layerFiles[layer.id];

          return (
            <div
              key={layer.id}
              onDrop={(e) => handleDrop(e, layer.id)}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={handleDragLeave}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: audioMutes[layer.id] ? 0.35 : 1,
                transition: 'all 0.2s',
                padding: '2px 4px',
                borderRadius: 4,
                background: isDragOver ? layer.color + '22' : 'transparent',
                outline: isDragOver ? `2px dashed ${layer.color}` : 'none',
              }}
            >
              <button
                onClick={() => setAudioMutes(prev => ({ ...prev, [layer.id]: !prev[layer.id] }))}
                style={{
                  background: audioMutes[layer.id] ? theme.danger + '33' : 'transparent',
                  border: `1px solid ${audioMutes[layer.id] ? theme.danger : theme.panelBorder}`,
                  color: audioMutes[layer.id] ? theme.danger : theme.textDim,
                  padding: '2px 6px', borderRadius: 3, fontFamily: fonts.mono,
                  fontSize: 9, cursor: 'pointer', minWidth: 22,
                }}
              >
                {audioMutes[layer.id] ? 'M' : '▶'}
              </button>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: hasFile ? layer.color : theme.textDim + '44',
                flexShrink: 0,
              }} />
              <div style={{ minWidth: 100 }}>
                <span style={{ fontSize: 10, color: theme.text, display: 'block' }}>
                  {layer.label}
                </span>
                {hasFile && (
                  <span style={{ fontSize: 8, color: theme.textDim, display: 'block' }}>
                    {layerFiles[layer.id]}
                  </span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <Slider
                  value={audioLevels[layer.id]}
                  onChange={(v) => setAudioLevels(prev => ({ ...prev, [layer.id]: v }))}
                  color={layer.color}
                  showValue
                />
              </div>
              {layer.id === 'moottoritie' && (
                <Btn
                  small
                  active={motorwayAuto}
                  onClick={() => setMotorwayAuto(!motorwayAuto)}
                  color={theme.warn}
                >
                  {motorwayAuto ? 'AUTO' : 'MAN'}
                </Btn>
              )}
            </div>
          );
        })}
      </div>

      {/* SFX Triggers */}
      <div style={{ marginTop: 4 }}>
        <div style={{
          fontSize: 9, color: theme.textDim, letterSpacing: '0.1em',
          textTransform: 'uppercase', marginBottom: 6,
        }}>
          SFX Triggers
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SFX_TRIGGERS.map(sfx => (
            <button
              key={sfx.id}
              onClick={() => onTriggerSfx(sfx)}
              style={{
                background: sfxActive === sfx.id ? theme.warn + '33' : theme.bg,
                border: `1px solid ${sfxActive === sfx.id ? theme.warn : theme.panelBorder}`,
                color: sfxActive === sfx.id ? theme.warn : theme.text,
                padding: '8px 16px', borderRadius: 6, fontFamily: fonts.mono,
                fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
                transform: sfxActive === sfx.id ? 'scale(0.95)' : 'scale(1)',
              }}
            >
              {sfx.label}
              <span style={{ fontSize: 8, color: theme.textDim, marginLeft: 6 }}>
                [{sfx.key}]
              </span>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
