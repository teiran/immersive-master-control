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
let sceneSeq = 0; // sequence counter for incoming POSTs

let sceneData = {
  // Plant counts (3 scent-mapped types)
  flowers: 0,
  evergreen: 0,
  eucalyptus: 0,

  // World state from Godot
  dayNightCycle: 0,        // 0.0 (midnight) → 0.5 (noon) → 1.0 (midnight)
  waterCloseness: 0,       // 0–100, how close the player is to water
  cloudiness: 0,           // 0–100
  rain: 0,                 // 0–100 intensity
  onField: false,          // true when player is on open field (kahina source)
  speed: 0,                // camera movement speed
};

// Environment state controlled by master (sent back to Godot)
let environmentState = { wind: 0, scent: 'off' };
let windMode = 'auto'; // 'auto' = Godot controls wind, 'manual' = UI slider
let windSendInterval = 5000; // ms between RPi sends in auto mode
let latestGodotWind = 0; // latest wind value from Godot
let windTimer = null; // auto-send timer
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

// Godot sends scene state — handles up to 10 req/s
// Log throttled to 1/s to avoid console spam, but every request is processed
let lastSceneLog = 0;

app.post('/api/scene', (req, res) => {
  sceneSeq++;
  sceneData = {
    flowers: req.body.flowers ?? sceneData.flowers,
    evergreen: req.body.evergreens ?? sceneData.evergreen,
    eucalyptus: sceneData.eucalyptus,
    dayNightCycle: req.body.dayNightCycle ?? sceneData.dayNightCycle,
    waterCloseness: req.body.waterCloseness ?? sceneData.waterCloseness,
    cloudiness: req.body.cloudiness ?? sceneData.cloudiness,
    rain: req.body.rain ?? sceneData.rain,
    onField: req.body.onField ?? sceneData.onField,
    speed: req.body.speed ?? sceneData.speed,
  };

  // Store latest wind from Godot, timer handles sending to RPi
  if (req.body.wind != null) {
    latestGodotWind = req.body.wind;
    broadcast('wind', { speed: req.body.wind, mode: windMode });
  }

  const now = Date.now();
  if (now - lastSceneLog >= 1000) {
    console.log(`[Scene] #${sceneSeq} F:${sceneData.flowers} E:${sceneData.evergreen} W:${req.body.wind ?? '-'}`);
    lastSceneLog = now;
  }

  broadcast('scene', { ...sceneData, _seq: sceneSeq });

  res.json({
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

const RPI_URL = process.env.RPI_URL || 'http://raspberrypi.local:8080';

async function sendWindToRpi(speed) {
  const rounded = Math.round(speed);
  environmentState.wind = rounded;
  console.log(`[Wind] → POST ${RPI_URL}/set?speed=${rounded}`);
  try {
    const rpiRes = await fetch(`${RPI_URL}/set?speed=${rounded}`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    });
    return await rpiRes.text();
  } catch (err) {
    console.warn(`[Wind] RPi unreachable: ${err.message}`);
    return null;
  }
}

// ─── WIND AUTO TIMER ────────────────────────────────────────
// Sends latest Godot wind value to RPi at the configured interval
function startWindTimer() {
  stopWindTimer();
  if (windMode !== 'auto') return;
  windTimer = setInterval(() => {
    sendWindToRpi(latestGodotWind);
  }, windSendInterval);
  console.log(`[Wind] Auto timer started: every ${windSendInterval}ms`);
}

function stopWindTimer() {
  if (windTimer) {
    clearInterval(windTimer);
    windTimer = null;
  }
}

// Start auto timer on boot
startWindTimer();

// Manual wind from UI — stops auto timer, sends directly
app.post('/api/wind', async (req, res) => {
  const speed = req.body.speed ?? req.body.intensity ?? 0;
  if (req.body.mode != null) windMode = req.body.mode;
  else windMode = 'manual';
  stopWindTimer();
  const result = await sendWindToRpi(speed);
  broadcast('wind', { speed, mode: windMode });
  res.json({ ok: true, rpi: result ?? 'offline', mode: windMode });
});

// Switch wind mode and/or send interval
app.post('/api/wind/mode', (req, res) => {
  if (req.body.mode) windMode = req.body.mode;
  if (req.body.intervalMs != null) windSendInterval = req.body.intervalMs;
  console.log(`[Wind] Mode → ${windMode}, interval → ${windSendInterval}ms`);
  startWindTimer(); // restart timer with new settings
  broadcast('wind', { speed: environmentState.wind, mode: windMode });
  res.json({ ok: true, mode: windMode, intervalMs: windSendInterval });
});

app.get('/api/wind/health', async (req, res) => {
  try {
    await fetch(RPI_URL, { signal: AbortSignal.timeout(3000) });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
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

// ─── SERVE FRONTEND (production build) ──────────────────────
const DIST_DIR = join(__dirname, '..', 'dist');
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/data') || req.path === '/health' || req.path === '/ws') return next();
    res.sendFile(join(DIST_DIR, 'index.html'));
  });
}

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
