# Multi-sensory Immersive System — Master Control

Master control dashboard for a multi-sensory art installation. Orchestrates a Godot 3D world, wind machine (Raspberry Pi), smell machine (Arduino), layered audio engine, and AI-generated storytelling.

## Architecture

```
┌─────────────┐    POST /api/scene     ┌──────────────┐
│   Godot 3D  │ ───────────────────▶   │              │
│   World     │ ◀─────────────────── ─ │   Backend    │
│             │    { wind, scent }     │   (Express)  │
└─────────────┘                        │   port 3001  │
                                       │              │
┌─────────────┐    POST /wind          │              │
│ Raspberry Pi│ ◀───────────────────── │              │
│ Wind Machine│                        └──────┬───────┘
└─────────────┘                               │ WebSocket
                                              │
                                       ┌──────┴───────┐
┌─────────────┐    Web Serial API      │   Frontend   │
│   Arduino   │ ◀───────────────────── │   (React)    │
│ Smell Machine│                       │   port 3000  │
└─────────────┘                        └──────┬───────┘
                                              │
┌─────────────┐    Claude API                 │
│  AI Story   │ ◀─────────────────────────────┤
│  Generator  │                               │
└─────────────┘                               │
                                              │
┌─────────────┐    ElevenLabs API             │
│  TTS Voice  │ ◀─────────────────────────────┘
│  Narration  │
└─────────────┘
```

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USER/immersive-master-control.git
cd immersive-master-control

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your API keys and RPi address

# 4. Start development
npm run dev        # Frontend on http://localhost:3000
npm run server     # Backend on http://localhost:3001 (in another terminal)
```

## Project Structure

```
immersive-master-control/
├── public/                    # Static assets
│   └── audio/                 # Place audio files here
│       ├── base-ambient.mp3
│       ├── tuuli.mp3
│       ├── vesi.mp3
│       ├── yopaiva.mp3
│       ├── pilvisyys.mp3
│       ├── kahina.mp3
│       ├── linnut.mp3
│       ├── moottoritie.mp3
│       └── sfx/
│           ├── thunder.mp3
│           ├── splash.mp3
│           ├── crack.mp3
│           └── owl.mp3
├── server/
│   └── index.js               # Express + WebSocket backend
├── src/
│   ├── main.jsx               # React entry
│   ├── App.jsx                # Main app — wires all panels
│   ├── config.js              # All configuration in one place
│   ├── theme.js               # Colors and fonts
│   ├── components/
│   │   ├── ui.jsx             # Shared: Panel, Slider, Btn
│   │   ├── GodotPanel.jsx     # Scene data display
│   │   ├── AudioPanel.jsx     # 8-layer mixer + SFX
│   │   ├── WindPanel.jsx      # Wind auto/manual control
│   │   ├── SmellPanel.jsx     # Arduino scent selector
│   │   ├── StoryPanel.jsx     # Image scan + AI stories
│   │   ├── TriggersPanel.jsx  # Automation rules + system log
│   │   └── ApiFooter.jsx      # API contract reference
│   └── utils/
│       ├── api.js             # HTTP calls: Godot, RPi, Claude, ElevenLabs
│       ├── audio.js           # Web Audio API engine
│       ├── logger.js          # System logger
│       └── serial.js          # Web Serial for Arduino
├── index.html
├── vite.config.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Systems

### Godot Scene (bidirectional)
- **Godot → Master**: `POST /api/scene` with `{ trees, flowers, other }`
- **Master → Godot**: Response contains `{ wind, scent, story? }`
- In dev mode: simulates scene data when Godot is offline

### Wind Machine (Raspberry Pi)
- `POST /api/wind` with `{ intensity: 0-100 }`
- **Auto mode**: wind intensity derived from plant density
- **Manual mode**: slider override
- Backend proxies to RPi Flask/FastAPI server

### Smell Machine (Arduino via Web Serial)
- Direct browser → Arduino via Web Serial API (Chrome/Edge only)
- Serial commands: `S0` (off), `S1` (forest), `S2` (flowers), `S3` (rain), `S4` (earth), `S5` (water)
- Baud rate: 9600 (configurable in `config.js`)

### Audio Engine
- **Base track**: 48h ambient loop
- **Environment layers**: Tuuli, Vesi, Yö/Päivä, Pilvisyys/Sade, Kahina/Lehdet, Linnunlaulu
- **Moottoritie**: random volume dimming up/down
- **SFX**: one-shot triggers (Ukkonen, Roiske, Risahdus, Pöllö)
- Place `.mp3` files in `public/audio/`

### AI Story Engine
1. Scan/upload an image
2. Image pushed to Godot world
3. Claude generates a Finnish story (1-3 min read)
4. ElevenLabs converts to speech
5. Narration plays through audio system

## Godot Integration

In your Godot project, add an HTTP client that sends scene data:

```gdscript
# GDScript example
extends Node

var http = HTTPClient.new()
var master_url = "http://localhost:3001"

func _process(delta):
    # Send scene data every few seconds
    if should_update():
        var data = {
            "trees": count_trees(),
            "flowers": count_flowers(),
            "other": count_other_plants()
        }
        send_to_master(data)

func send_to_master(data):
    var json = JSON.stringify(data)
    var headers = ["Content-Type: application/json"]
    $HTTPRequest.request(
        master_url + "/api/scene",
        headers,
        HTTPClient.METHOD_POST,
        json
    )

func _on_http_request_completed(result, code, headers, body):
    var response = JSON.parse_string(body.get_string_from_utf8())
    # response contains { wind, scent, story? }
    apply_wind(response.get("wind", 0))
    apply_scent(response.get("scent", "off"))
```

## Raspberry Pi Setup

Flask server for the wind machine:

```python
# wind_server.py — run on Raspberry Pi
from flask import Flask, request, jsonify
import RPi.GPIO as GPIO

app = Flask(__name__)
WIND_PIN = 18  # PWM pin

GPIO.setmode(GPIO.BCM)
GPIO.setup(WIND_PIN, GPIO.OUT)
pwm = GPIO.PWM(WIND_PIN, 1000)
pwm.start(0)

@app.route('/wind', methods=['POST'])
def set_wind():
    intensity = request.json.get('intensity', 0)
    duty = max(0, min(100, intensity))
    pwm.ChangeDutyCycle(duty)
    return jsonify({"ok": True, "intensity": duty})

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

## Arduino Smell Machine

```cpp
// Arduino sketch for smell machine
// Receives serial commands: S0-S5

const int PUMP_PINS[] = {2, 3, 4, 5, 6};  // 5 scent pumps
const int NUM_PUMPS = 5;

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < NUM_PUMPS; i++) {
    pinMode(PUMP_PINS[i], OUTPUT);
    digitalWrite(PUMP_PINS[i], LOW);
  }
}

void allOff() {
  for (int i = 0; i < NUM_PUMPS; i++) {
    digitalWrite(PUMP_PINS[i], LOW);
  }
}

void loop() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "S0") {
      allOff();
      Serial.println("OK:OFF");
    }
    else if (cmd.startsWith("S") && cmd.length() == 2) {
      int pump = cmd.charAt(1) - '1';  // S1->0, S2->1, etc.
      if (pump >= 0 && pump < NUM_PUMPS) {
        allOff();
        digitalWrite(PUMP_PINS[pump], HIGH);
        Serial.println("OK:" + cmd);
      }
    }
  }
}
```

## Browser Requirements

Web Serial API requires **Chrome** or **Edge** (not Firefox/Safari). The frontend will show an error if Web Serial is not available.

## License

MIT
