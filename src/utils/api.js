// ─── API COMMUNICATION ───────────────────────────────────────
// Handles all HTTP communication with external systems

import { CONFIG } from '../config.js';

// ─── GODOT ──────────────────────────────────────────────────

/**
 * Fetch current scene data from Godot.
 * Godot should expose: GET /api/scene → { trees, flowers, other }
 */
export async function fetchGodotScene() {
  const res = await fetch(`${CONFIG.GODOT_API}/api/scene`);
  if (!res.ok) throw new Error(`Godot HTTP ${res.status}`);
  return res.json();
}

/**
 * Send environment state back to Godot.
 * POST /api/environment → { wind, scent, story?, image? }
 */
export async function sendGodotEnvironment(data) {
  const res = await fetch(`${CONFIG.GODOT_API}/api/environment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Godot POST HTTP ${res.status}`);
  return res.json();
}

/**
 * Push a scanned image to Godot world.
 * POST /api/image → { imageData (base64), metadata }
 */
export async function sendImageToGodot(imageBase64, metadata = {}) {
  const res = await fetch(`${CONFIG.GODOT_API}/api/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, ...metadata }),
  });
  if (!res.ok) throw new Error(`Godot image POST HTTP ${res.status}`);
  return res.json();
}

// ─── RASPBERRY PI WIND ──────────────────────────────────────

/**
 * Send wind intensity to Raspberry Pi.
 * POST /wind → { intensity: 0-100 }
 */
export async function sendWindCommand(intensity) {
  const res = await fetch(`${CONFIG.RPI_WIND_API}/wind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intensity: Math.round(intensity) }),
  });
  if (!res.ok) throw new Error(`RPi HTTP ${res.status}`);
  return res.json();
}

/**
 * Check RPi connection.
 * GET /health → { status: 'ok' }
 */
export async function checkRpiHealth() {
  const res = await fetch(`${CONFIG.RPI_WIND_API}/health`, {
    signal: AbortSignal.timeout(3000),
  });
  return res.ok;
}

// ─── AUDIO UPLOAD & STATE PERSISTENCE ────────────────────────

const SERVER = `http://${location.hostname}:3001`;

/**
 * Upload an audio file to the server. Returns the server path.
 */
export async function uploadAudio(file) {
  const form = new FormData();
  form.append('audio', file);
  const res = await fetch(`${SERVER}/api/audio/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json(); // { ok, path, originalName }
}

/**
 * Save full app state to server.
 */
export async function saveState(state) {
  const res = await fetch(`${SERVER}/api/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  return res.json();
}

/**
 * Load saved app state from server. Returns null if none saved.
 */
export async function loadState() {
  const res = await fetch(`${SERVER}/api/state`);
  return res.json();
}

// ─── AI STORY GENERATION ────────────────────────────────────

/**
 * Generate a story from an image using Claude API.
 * Returns the story text in Finnish.
 */
export async function generateStory(imageBase64, mediaType = 'image/jpeg') {
  const response = await fetch(`${CONFIG.ANTHROPIC_API}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.STORY_AI_MODEL,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `You are a storyteller for an immersive multi-sensory art installation set in a living forest world. Look at this image and create a short, evocative story (1-3 minutes when read aloud, approximately 200-400 words). Write in Finnish. Include sensory details about wind, smell, sounds, and light. The story should feel magical, grounded in nature, and suitable for ambient narration in a forest world.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.find(c => c.type === 'text')?.text;
  if (!text) throw new Error('No text in AI response');
  return text;
}

// ─── ELEVENLABS TTS ─────────────────────────────────────────

/**
 * Convert text to speech using ElevenLabs.
 * Returns an audio Blob.
 */
export async function textToSpeech(text, voiceId = '21m00Tcm4TlvDq8ikWAM') {
  if (!CONFIG.ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(
    `${CONFIG.ELEVENLABS_API}/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': CONFIG.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs HTTP ${response.status}`);
  }

  return await response.blob();
}
