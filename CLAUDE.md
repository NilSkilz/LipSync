# Motion Trainer Server

A TypeScript backend for a wearable motion-tracking training system with haptic feedback.

## Overview

This project enables motion-based training with real-time feedback. A custom ESP32 device with IMU sensor tracks motion and controls a vibration collar directly. The server evaluates motion against configurable targets and sends feedback commands back to the device.

```
┌──────────────────┐
│    Phone SPA     │  React + Vite
│  (set targets)   │  Connects via WebSocket
└────────┬─────────┘
         │ WS (/phone)
         ▼
┌──────────────────┐         ┌──────────────────┐
│   Node Server    │◄──WS───►│  ESP32 Device    │
│   (this repo)    │ (/sensor)│  (Custom Firmware)│
│                  │         │                  │
│  - Session state │         │  - IMU sensor    │
│  - Motion eval   │         │  - Collar control│
│  - Feedback logic│         └──────────────────┘
└──────────────────┘
```

## Tech Stack

- **Runtime**: Node.js with ES Modules
- **Language**: TypeScript (strict mode)
- **Framework**: Express 4.x
- **WebSocket**: ws library
- **Build**: tsc → dist/
- **Dev**: tsx watch
- **Hosting**: Railway

## Project Structure

```
motion-trainer-server/
├── src/
│   ├── index.ts              # Express + WebSocket server setup
│   └── types.ts              # All TypeScript interfaces
├── package.json
├── tsconfig.json
├── railway.json
└── .env                      # Local env vars (not committed)
```

## Key Components

### `src/index.ts` - Main Server

Sets up Express with WebSocket upgrade handling. Manages two WebSocket endpoints:
- `/phone` - Single connection from the control SPA
- `/sensor` - Single connection from the ESP32 device

Maintains a `session` object with current state (active, targets, feedbackIntensity).

Handles incoming messages via a switch on `msg.type`:
- `setTargets` - Updates pace/depth/tolerance targets
- `setIntensity` - Sets feedback intensity (0-100)
- `start` / `stop` - Session control
- `testVibrate` - Manual vibration test
- `motion` - Incoming sensor data, triggers evaluation

Sends feedback commands back to the ESP32 device which controls the collar directly.

### `src/types.ts` - Type Definitions

```typescript
interface MotionSample {
  timestamp: number;
  pitch: number;
  roll: number;
  yaw: number;
  accelX: number;
  accelY: number;
  accelZ: number;
}

interface Targets {
  paceBPM: number;        // Target strokes per minute
  depthDegrees: number;   // Target pitch range
  tolerance: number;      // 0-1, deviation threshold for feedback
}

interface EvaluationResult {
  deviation: number;
  currentPace: number;
  currentDepth: number;
}

interface Session {
  active: boolean;
  targets: Targets;
  feedbackIntensity: number;  // 0-100
}
```

## WebSocket Protocol

### Phone → Server

```typescript
{ "type": "setTargets", "data": { "paceBPM": 60, "depthDegrees": 30, "tolerance": 0.3 } }
{ "type": "setIntensity", "data": { "intensity": 50 } }
{ "type": "start" }
{ "type": "stop" }
{ "type": "testVibrate", "data": { "intensity": 30 } }
```

### Sensor → Server

```typescript
{
  "type": "motion",
  "data": {
    "timestamp": 1699999999999,
    "pitch": 15.5,
    "roll": 2.1,
    "yaw": 0.3,
    "accelX": 0.1,
    "accelY": 0.05,
    "accelZ": 9.8
  }
}
```

### Server → Phone

```typescript
{ "type": "state", "data": { "active": false, "targets": {...}, ... } }
{ "type": "motionUpdate", "data": { "sample": {...}, "result": {...} } }
{ "type": "sessionStarted" }
{ "type": "sessionStopped" }
{ "type": "targetsUpdated", "data": {...} }
```

### Server → Device

```typescript
{ "type": "vibrate", "data": { "intensity": 50, "duration": 300 } }
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |

## Commands

```bash
npm run dev      # Start with tsx watch (hot reload)
npm run build    # Compile TypeScript to dist/
npm run start    # Run compiled JS (production)
```

## Related Components (separate repos/projects)

### Phone SPA
- React + Vite + Tailwind
- Connects to `wss://<server>/phone`
- Controls: pace slider, depth slider, tolerance, intensity, start/stop

### ESP32 Device Firmware
- Custom firmware for ESP32 Dev Module (ESP-WROOM-32 with CH340C USB-serial)
- Integrated IMU sensor (motion tracking)
- Direct collar control (vibration feedback)
- Connects to `wss://<server>/sensor`
- Sends motion samples as JSON, receives vibrate commands

## Development Notes

- Motion evaluation uses cycle-based detection (in/out motions) rather than raw sample analysis
- Feedback is triggered at cycle boundaries for more natural timing
- Vibrate commands are sent directly to the ESP32 device which controls the collar
- Railway auto-detects Node.js and runs the build/start scripts

## Conventions

- Use ES Module imports (`import`/`export`)
- Prefer interfaces over types for object shapes
- Keep WebSocket message handlers in the main switch statement
- All async functions should have error handling