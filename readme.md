# Motion Trainer Server

WebSocket server that connects a motion sensor to OpenShock for feedback-based training.

## Architecture

```
Phone SPA ──► This Server ──► OpenShock Cloud ──► Your Hub ──► Collar
                  ▲
                  │
           Motion Sensor
           (ESP32 + IMU)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your OpenShock credentials:

```bash
cp .env.example .env
```

You'll need:
- **API Token**: openshock.app → Settings → API Tokens → Create new
- **Device ID**: openshock.app → Devices → click your hub → ID from the URL
- **Shocker ID**: openshock.app → Shockers → your shocker's ID

### 3. Run locally

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## Deploy to Railway

### Option A: Railway CLI

```bash
# Install CLI
npm i -g @railway/cli

# Login and init
railway login
railway init

# Set environment variables
railway variables set OPENSHOCK_API_TOKEN=your_token
railway variables set OPENSHOCK_DEVICE_ID=your_device_id  
railway variables set OPENSHOCK_SHOCKER_ID=your_shocker_id

# Deploy
railway up
```

### Option B: GitHub Integration

1. Push this repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables in Railway dashboard
5. Deploy

## WebSocket API

### Endpoints

- `wss://your-server.railway.app/phone` - Phone SPA connection
- `wss://your-server.railway.app/sensor` - Motion sensor connection

### Phone → Server Messages

```typescript
// Set target pace and depth
{ "type": "setTargets", "data": { "paceBPM": 60, "depthDegrees": 30, "tolerance": 0.3 } }

// Set feedback intensity (0-100)
{ "type": "setIntensity", "data": { "intensity": 50 } }

// Start/stop session
{ "type": "start" }
{ "type": "stop" }

// Test vibration
{ "type": "testVibrate", "data": { "intensity": 30 } }
```

### Sensor → Server Messages

```typescript
// Motion sample (send at ~50Hz)
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

### Server → Client Messages

```typescript
// Session state (sent on phone connect)
{ "type": "state", "data": { "active": false, "targets": {...}, ... } }

// Motion update (sent to phone for visualization)
{ "type": "motionUpdate", "data": { "sample": {...}, "result": {...} } }

// Session events
{ "type": "sessionStarted" }
{ "type": "sessionStopped" }
{ "type": "targetsUpdated", "data": {...} }
```

## Project Structure

```
├── src/
│   ├── index.ts           # Express + WebSocket server
│   ├── types.ts           # TypeScript interfaces
│   ├── openshock/
│   │   └── client.ts      # OpenShock WebSocket client
│   └── motion/
│       └── evaluator.ts   # Motion analysis algorithm
├── package.json
├── tsconfig.json
├── railway.json
└── .env.example
```
