// ─── MASTER CONTROL BACKEND SERVER ───────────────────────────
// Bridges Godot ↔ Frontend ↔ Raspberry Pi ↔ ElevenLabs
//
// Run: node server/index.js
// Default port: 3001

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const AUDIO_DIR = join(DATA_DIR, 'audio');
const STATE_FILE = join(DATA_DIR, 'state.json');

// Ensure data directories exist
mkdirSync(AUDIO_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve uploaded audio files
app.use('/data/audio', express.static(AUDIO_DIR));

// ─── STATE ───────────────────────────────────────────────────

// Scene data from Godot (updated every ~1s poll)
let sceneData = {
  // Plant counts (3 scent-mapped types + 1 TBD)
  flowers: 0,
  evergreen: 0,
  thirdPlant: 0,          // TBD — third plant type

  // World state from Godot
  dayNightCycle: 0,        // 0.0 (midnight) → 0.5 (noon) → 1.0 (midnight)
  waterCloseness: 0,       // 0–100, how close the player is to water
  cloudiness: 0,           // 0–100
  rain: 0,                 // 0–100 intensity
  onField: false,          // true when player is on open field (kahina source)
};

// Environment state controlled by master (sent back to Godot)
let environmentState = { wind: 0, scent: 'off' };
let connectedClients = new Set();

// ─── WEBSOCKET FOR REAL-TIME UPDATES ─────────────────────────
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  connectedClients.add(ws);
  console.log(`[WS] Client connected (${connectedClients.size} total)`);

  // Send current state on connect
  ws.send(JSON.stringify({ type: 'scene', data: sceneData }));
  ws.send(JSON.stringify({ type: 'environment', data: environmentState }));

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[WS] Client disconnected (${connectedClients.size} total)`);
  });
});

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  for (const client of connectedClients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

// ─── GODOT ENDPOINTS ─────────────────────────────────────────

// Godot polls this endpoint every ~1s with current world state
app.post('/api/scene', (req, res) => {
  sceneData = {
    // Plants
    flowers: req.body.flowers ?? sceneData.flowers,
    evergreen: req.body.evergreen ?? sceneData.evergreen,
    thirdPlant: req.body.thirdPlant ?? sceneData.thirdPlant,

    // World state
    dayNightCycle: req.body.dayNightCycle ?? sceneData.dayNightCycle,
    waterCloseness: req.body.waterCloseness ?? sceneData.waterCloseness,
    cloudiness: req.body.cloudiness ?? sceneData.cloudiness,
    rain: req.body.rain ?? sceneData.rain,
    onField: req.body.onField ?? sceneData.onField,
  };

  broadcast('scene', sceneData);

  // Respond with commands for Godot
  res.json({
    wind: environmentState.wind,
    scent: environmentState.scent,
  });
});

// Frontend or polling can GET scene data
app.get('/api/scene', (req, res) => {
  res.json(sceneData);
});

// Frontend sends environment updates
app.post('/api/environment', (req, res) => {
  environmentState = { ...environmentState, ...req.body };
  console.log(`[Env] Updated:`, environmentState);
  broadcast('environment', environmentState);
  res.json({ ok: true });
});

// ─── IMAGE INJECTION TO GODOT ────────────────────────────────

app.post('/api/image', (req, res) => {
  const { image, metadata } = req.body;
  console.log(`[Image] Received image for Godot injection`);
  broadcast('image', { image, metadata });
  res.json({ ok: true });
});

// ─── WIND PROXY TO RASPBERRY PI ──────────────────────────────
// If you want the server to relay wind commands to RPi

const RPI_URL = process.env.RPI_URL || 'http://raspberrypi.local:5000';

app.post('/api/wind', async (req, res) => {
  const { intensity } = req.body;
  environmentState.wind = intensity;
  console.log(`[Wind] Intensity: ${intensity}%`);

  try {
    const rpiRes = await fetch(`${RPI_URL}/wind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intensity }),
      signal: AbortSignal.timeout(3000),
    });
    const data = await rpiRes.json();
    res.json({ ok: true, rpi: data });
  } catch (err) {
    console.warn(`[Wind] RPi unreachable: ${err.message}`);
    res.json({ ok: true, rpi: 'offline', mock: true });
  }
});

// ─── STORY TTS PROXY ─────────────────────────────────────────
// Proxy ElevenLabs calls to avoid CORS issues from frontend

app.post('/api/tts', async (req, res) => {
  const { text, voiceId } = req.body;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' });
  }

  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || '21m00Tcm4TlvDq8ikWAM'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.6, similarity_boost: 0.75 },
        }),
      }
    );

    if (!ttsRes.ok) {
      throw new Error(`ElevenLabs HTTP ${ttsRes.status}`);
    }

    res.set('Content-Type', 'audio/mpeg');
    const buffer = await ttsRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(`[TTS] Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── AUDIO UPLOAD & STATE PERSISTENCE ────────────────────────

const upload = multer({
  storage: multer.diskStorage({
    destination: AUDIO_DIR,
    filename: (req, file, cb) => {
      // Keep original name, add timestamp to avoid collisions
      const ext = file.originalname.split('.').pop();
      const base = file.originalname.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      cb(null, `${base}_${Date.now()}.${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
});

// Upload audio file → saved to data/audio/, returns server path
app.post('/api/audio/upload', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const serverPath = `/data/audio/${req.file.filename}`;
  console.log(`[Audio] Uploaded: ${req.file.originalname} → ${serverPath}`);
  res.json({ ok: true, path: serverPath, originalName: req.file.originalname });
});

// Save full app state (tracks, volumes, modes, etc.)
app.post('/api/state', (req, res) => {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(req.body, null, 2));
    console.log('[State] Saved');
    res.json({ ok: true });
  } catch (err) {
    console.error('[State] Save error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Load saved state
app.get('/api/state', (req, res) => {
  try {
    if (existsSync(STATE_FILE)) {
      const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
      res.json(state);
    } else {
      res.json(null);
    }
  } catch (err) {
    console.error('[State] Load error:', err.message);
    res.json(null);
  }
});

// ─── HEALTH ──────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    clients: connectedClients.size,
    scene: sceneData,
  });
});

// ─── START ───────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  Multi-sensory Master Control — Backend      ║
║  HTTP:  http://localhost:${PORT}               ║
║  WS:    ws://localhost:${PORT}/ws              ║
╚══════════════════════════════════════════════╝
  `);
});
