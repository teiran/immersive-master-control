// ─── SYSTEM CONFIGURATION ────────────────────────────────────
// Edit these values to match your hardware setup

export const CONFIG = {
  // Godot game server — receives scene data, sends back environment state
  GODOT_API: 'http://localhost:8080',

  // Raspberry Pi wind machine — Flask/FastAPI endpoint
  RPI_WIND_API: 'http://raspberrypi.local:5000',

  // ElevenLabs TTS for AI story narration
  ELEVENLABS_API: 'https://api.elevenlabs.io/v1',
  ELEVENLABS_API_KEY: '', // Set via env or .env file

  // Anthropic API for AI story generation
  ANTHROPIC_API: 'https://api.anthropic.com/v1',
  STORY_AI_MODEL: 'claude-sonnet-4-20250514',

  // Arduino serial connection
  SERIAL_BAUD: 9600,

  // Godot polling interval (ms) — or use WebSocket
  GODOT_POLL_INTERVAL: 4000,

  // Motorway track random dim interval range (ms)
  MOTORWAY_DIM_MIN: 3000,
  MOTORWAY_DIM_MAX: 8000,
};

// ─── SCENT DEFINITIONS ──────────────────────────────────────
// Each maps to an Arduino serial command
export const SCENT_TYPES = [
  { id: 'forest',  label: 'Metsä',  icon: '🌲', cmd: 'S1' },
  { id: 'flowers', label: 'Kukat',  icon: '🌸', cmd: 'S2' },
  { id: 'rain',    label: 'Sade',   icon: '🌧', cmd: 'S3' },
  { id: 'earth',   label: 'Maa',    icon: '🪨', cmd: 'S4' },
  { id: 'water',   label: 'Vesi',   icon: '💧', cmd: 'S5' },
  { id: 'off',     label: 'Pois',   icon: '⭕', cmd: 'S0' },
];

// ─── AUDIO LAYER DEFINITIONS ────────────────────────────────
export const AUDIO_LAYERS = [
  { id: 'base',         label: 'Base Ambient',      group: 'base',  color: '#4a7c59', file: 'base-ambient.mp3' },
  { id: 'tuuli',        label: 'Tuulen vaikutus',   group: 'env',   color: '#7ca5b8', file: 'tuuli.mp3' },
  { id: 'vesi',         label: 'Veden läheisyys',   group: 'env',   color: '#3d8bbd', file: 'vesi.mp3' },
  { id: 'yopaiva',      label: 'Yö / Päivä',        group: 'env',   color: '#b89b4a', file: 'yopaiva.mp3' },
  { id: 'pilvisyys',    label: 'Pilvisyys & Sade',  group: 'env',   color: '#8b8b9e', file: 'pilvisyys.mp3' },
  { id: 'kahina',       label: 'Kahina & Lehdet',   group: 'env',   color: '#6b8e4e', file: 'kahina.mp3' },
  { id: 'linnut',       label: 'Linnunlaulu',       group: 'env',   color: '#c4a35a', file: 'linnut.mp3' },
  { id: 'moottoritie',  label: 'Moottoritie',       group: 'motor', color: '#9e5a5a', file: 'moottoritie.mp3' },
];

// ─── SFX DEFINITIONS ────────────────────────────────────────
export const SFX_TRIGGERS = [
  { id: 'thunder', label: 'Ukkonen',   key: 'T', file: 'sfx/thunder.mp3' },
  { id: 'splash',  label: 'Roiske',    key: 'R', file: 'sfx/splash.mp3' },
  { id: 'crack',   label: 'Risahdus',  key: 'C', file: 'sfx/crack.mp3' },
  { id: 'owl',     label: 'Pöllö',     key: 'O', file: 'sfx/owl.mp3' },
];

// ─── AUTOMATION RULES ───────────────────────────────────────
// These define when environment layers auto-trigger
export const AUTO_RULES = [
  { id: 'wind_trees',      condition: (scene) => scene.trees > 100,   action: 'wind +20%',           label: 'Trees > 100 → Wind +20%' },
  { id: 'scent_flowers',   condition: (scene) => scene.flowers > 300, action: 'scent:flowers',       label: 'Flowers > 300 → Scent: Kukat' },
  { id: 'night_birds',     condition: () => false,                    action: 'mute:linnut',         label: 'Night mode → Linnunlaulu OFF' },
  { id: 'rain_clouds',     condition: () => false,                    action: 'layer:pilvisyys+40',  label: 'Rain detected → Pilvisyys +40%' },
  { id: 'image_story',     condition: (_, meta) => meta.hasImages,    action: 'generate:story',      label: 'Image scan → Generate story' },
];
