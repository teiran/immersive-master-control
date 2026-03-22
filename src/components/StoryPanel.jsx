import React, { useRef } from 'react';
import { Panel, Btn } from './ui.jsx';
import { theme, fonts } from '../theme.js';

export function StoryPanel({
  storyImages, onImageUpload,
  currentStory, storyGenerating,
  storyPlaying, setStoryPlaying,
  onGenerateStory, onSendToGodot,
}) {
  const fileInputRef = useRef(null);

  return (
    <Panel
      title="AI Story Engine"
      icon="📖"
      status={storyGenerating ? 'warning' : 'connected'}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onImageUpload}
          style={{ display: 'none' }}
        />
        <Btn onClick={() => fileInputRef.current?.click()} color={theme.blue}>
          📷 Scan Image
        </Btn>
        <span style={{ fontSize: 9, color: theme.textDim }}>
          {storyImages.length} images scanned
        </span>
      </div>

      {/* Image thumbnails */}
      {storyImages.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
        }}>
          {storyImages.slice(0, 5).map(img => (
            <div
              key={img.id}
              onClick={() => onGenerateStory(img)}
              style={{
                width: 56, height: 56, borderRadius: 6, overflow: 'hidden',
                border: `1px solid ${theme.panelBorder}`, flexShrink: 0,
                cursor: 'pointer', position: 'relative',
              }}
            >
              <img
                src={img.src}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Generating indicator */}
      {storyGenerating && (
        <div style={{
          padding: 12, background: theme.bg, borderRadius: 6,
          fontSize: 11, color: theme.warn, textAlign: 'center',
        }}>
          ⏳ AI generating story...
        </div>
      )}

      {/* Current Story */}
      {currentStory && !storyGenerating && (
        <div style={{
          padding: 12, background: theme.bg, borderRadius: 6,
          maxHeight: 100, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 10, color: theme.text, lineHeight: 1.5 }}>
            {currentStory.text.substring(0, 300)}
            {currentStory.text.length > 300 && '...'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <Btn
              small
              color={theme.accent}
              active={storyPlaying}
              onClick={() => setStoryPlaying(!storyPlaying)}
            >
              {storyPlaying ? '⏸ Pause' : '▶ Narrate (TTS)'}
            </Btn>
            <Btn small color={theme.blue} onClick={onSendToGodot}>
              → Godot
            </Btn>
          </div>
        </div>
      )}
    </Panel>
  );
}
