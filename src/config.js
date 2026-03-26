// ─── SYSTEM CONFIGURATION ────────────────────────────────────
// Edit these values to match your hardware setup

export const CONFIG = {
  // Godot game server — receives scene data, sends back environment state
  GODOT_API: "http://localhost:8080",

  // Raspberry Pi wind machine — Flask/FastAPI endpoint
  RPI_WIND_API: "http://raspberrypi.local:5000",

  // ElevenLabs TTS for AI story narration
  ELEVENLABS_API: "https://api.elevenlabs.io/v1",
  ELEVENLABS_API_KEY: "", // Set via env or .env file

  // Anthropic API for AI story generation
  ANTHROPIC_API: "https://api.anthropic.com/v1",
  STORY_AI_MODEL: "claude-sonnet-4-20250514",

  // Arduino serial connection
  SERIAL_BAUD: 9600,

  // Godot polling interval (ms) — Godot pulls this service at this rate
  GODOT_POLL_INTERVAL: 1000,

  // Scent auto-cycle interval (ms) — each cycle distributes motor time by plant %
  SCENT_CYCLE_INTERVAL: 10000,

  // Motorway track random dim interval range (ms)
  MOTORWAY_DIM_MIN: 3000,
  MOTORWAY_DIM_MAX: 8000,
};

// ─── SCENT DEFINITIONS ──────────────────────────────────────
// 3 scents mapped to plant types + off. Each maps to an Arduino serial command.
export const SCENT_TYPES = [
  { id: "flowers", label: "Kukat", icon: "🌸", cmd: "set 3", plant: "flowers" },
  {
    id: "evergreen",
    label: "Havumetsä",
    icon: "🌲",
    cmd: "set 2",
    plant: "evergreen",
  },
  { id: "third", label: "TBD", icon: "❓", cmd: "set 1", plant: "thirdPlant" }, // TBD
  { id: "off", label: "Pois", icon: "⭕", cmd: "stop", plant: null },
];

// ─── DEFAULT TRACKS ─────────────────────────────────────────
// These are the starting tracks. More can be added from the frontend.
// type: 'loop' = continuous layer, 'trigger' = one-shot effect
// sceneLink: which scene value auto-drives this track's volume (null = manual only)
// triggerKey: keyboard shortcut for trigger tracks
export const DEFAULT_TRACKS = [
  {
    id: "base",
    label: "Base Ambient",
    type: "loop",
    color: "#4a7c59",
    sceneLink: null,
    triggerKey: null,
  },
  {
    id: "moottoritie",
    label: "Moottoritie",
    type: "loop",
    color: "#9e5a5a",
    sceneLink: null,
    triggerKey: null,
  },
  {
    id: "vesi",
    label: "Veden läheisyys",
    type: "loop",
    color: "#3d8bbd",
    sceneLink: "waterCloseness",
    triggerKey: null,
  },
  {
    id: "sade",
    label: "Sade",
    type: "loop",
    color: "#8b8b9e",
    sceneLink: "rain",
    triggerKey: null,
  },
  {
    id: "kahina",
    label: "Kahina & Lehdet",
    type: "loop",
    color: "#6b8e4e",
    sceneLink: "onField",
    triggerKey: null,
  },
  {
    id: "linnut",
    label: "Linnunlaulu",
    type: "loop",
    color: "#c4a35a",
    sceneLink: "dayNightCycle",
    triggerKey: null,
  },
];

// ─── SCENE LINK OPTIONS ─────────────────────────────────────
// Available scene values a track can be linked to for auto-volume
export const SCENE_LINK_OPTIONS = [
  { value: null, label: "Manual" },
  { value: "waterCloseness", label: "Water closeness" },
  { value: "rain", label: "Rain" },
  { value: "cloudiness", label: "Cloudiness" },
  { value: "dayNightCycle", label: "Day/Night cycle" },
  { value: "onField", label: "On field" },
];

// ─── TRACK COLORS FOR NEW TRACKS ────────────────────────────
export const TRACK_COLORS = [
  "#4a7c59",
  "#c474a0",
  "#7ca5b8",
  "#3d8bbd",
  "#b89b4a",
  "#8b8b9e",
  "#6b8e4e",
  "#c4a35a",
  "#9e5a5a",
  "#5a9e7c",
];

// ─── AUTOMATION RULES ───────────────────────────────────────
// These define when environment layers auto-trigger based on Godot scene data
export const AUTO_RULES = [
  {
    id: "scent_flowers",
    condition: (scene) => scene.flowers > 100,
    action: "scent:flowers",
    label: "Flowers > 100 → Scent: Kukat",
  },
  {
    id: "scent_evergreen",
    condition: (scene) => scene.evergreen > 100,
    action: "scent:evergreen",
    label: "Evergreen > 100 → Scent: Havumetsä",
  },
  {
    id: "night_birds",
    condition: (scene) => scene.dayNightCycle > 0.75,
    action: "mute:linnut",
    label: "Night → Linnunlaulu OFF",
  },
  {
    id: "water_layer",
    condition: (scene) => scene.waterCloseness > 50,
    action: "layer:vesi+50",
    label: "Near water → Vesi +50%",
  },
  {
    id: "rain_clouds",
    condition: (scene) => scene.rain > 30,
    action: "layer:pilvisyys+40",
    label: "Rain > 30 → Pilvisyys +40%",
  },
  {
    id: "field_kahina",
    condition: (scene) => scene.onField,
    action: "layer:kahina+60",
    label: "On field → Kahina +60%",
  },
];
