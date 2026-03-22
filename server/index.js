// ─── MASTER CONTROL BACKEND SERVER ───────────────────────────
// Bridges Godot ↔ Frontend ↔ Raspberry Pi ↔ ElevenLabs
//
// Run: node server/index.js
// Default port: 3001

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── STATE ───────────────────────────────────────────────────
let sceneData = { trees: 0, flowers: 0, other: 0 };
let environmentState = { wind: 0, scent: 'off', story: null };
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

// Godot sends scene data here
app.post('/api/scene', (req, res) => {
  const { trees, flowers, other } = req.body;
  sceneData = {
    trees: trees ?? 0,
    flowers: flowers ?? 0,
    other: other ?? 0,
  };

  console.log(`[Godot] Scene update: T:${sceneData.trees} F:${sceneData.flowers} O:${sceneData.other}`);
  broadcast('scene', sceneData);

  // Respond with current environment state so Godot knows wind/scent
  res.json(environmentState);
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
