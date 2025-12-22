# LipSync

A self-contained training system with haptic feedback. The ESP32 serves both the web app and handles all motion tracking and feedback - no external server needed.

## Overview

```
┌──────────────────┐         ┌──────────────────────────────────┐
│   Phone/Tablet   │         │         ESP32 Device             │
│    (Browser)     │◄──────►│                                  │
│                  │  WiFi   │  - Web server (serves React app) │
│  Opens:          │         │  - WebSocket server (/ws)        │
│  http://device   │         │  - IMU sensor (motion tracking)  │
│                  │         │  - RF transmitter (collar ctrl)  │
└──────────────────┘         └──────────────────────────────────┘
```

## Project Structure

```
lipsync/
├── client/                 # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── context/        # React contexts
│   │   ├── hooks/          # Custom hooks (useWebSocket, useAudio)
│   │   ├── styles/         # CSS
│   │   └── types.ts        # TypeScript types
│   ├── package.json
│   └── vite.config.ts
├── firmware/               # ESP32 firmware (PlatformIO)
│   ├── src/
│   │   └── main.cpp        # Web server + WebSocket + hardware control
│   ├── include/
│   │   ├── config.h        # Pin definitions, defaults
│   │   ├── rf_transmitter.h
│   │   └── motion_tracker.h
│   ├── data/               # Built web files (LittleFS) - gitignored
│   └── platformio.ini
├── enclosure/              # 3D printable enclosure
│   └── base.stl
└── screenshots/
```

## Hardware

- **Board**: ESP32-WROOM-32 Dev Module (generic, with CH340C USB-serial)
- **IMU**: MPU6050 (I2C: SDA=21, SCL=22) - optional
- **RF Transmitter**: 433MHz (pin 15) - for CaiXianlin protocol collar

## Building & Deploying

### Prerequisites

```bash
# Install PlatformIO CLI
brew install platformio

# Install client dependencies
cd client && npm install
```

### Build & Upload

```bash
# Build React app and copy to firmware data folder
cd client && npm run build && cp -r dist/* ../firmware/data/

# Upload firmware and filesystem to ESP32
cd ../firmware
pio run -t upload -e esp32dev      # Upload firmware (hold BOOT button)
pio run -t uploadfs -e esp32dev    # Upload web files to LittleFS
```

### Connecting

1. Power on ESP32
2. Connect to "LipSync" WiFi (password: `lipsync123`)
3. Open browser to `192.168.4.1` or `http://lipsync.local`

## WebSocket Protocol

All communication happens over WebSocket at `/ws`.

### Client → Device

```typescript
{ "type": "start" }
{ "type": "stop" }
{ "type": "setTargets", "data": { "paceBPM": 60, "depthDegrees": 30, "tolerance": 0.3 } }
{ "type": "setIntensity", "data": { "intensity": 50 } }
{ "type": "testVibrate", "data": { "intensity": 30 } }
{ "type": "testBeep" }
{ "type": "getState" }
```

### Device → Client

```typescript
{ "type": "state", "data": { "active": false, "targets": {...}, "rfAvailable": true, "imuAvailable": false } }
{ "type": "sessionStarted" }
{ "type": "sessionStopped" }
{ "type": "cycleResult", "data": { "currentBPM": 58, "deviation": 0.15, "feedback": false } }
```

## Configuration

Edit `firmware/include/config.h`:

```cpp
#define MDNS_HOSTNAME "lipsync"         // Access via http://lipsync.local
#define WS_PORT 80                      // HTTP/WebSocket port
#define SHOCKER_TRANSMITTER_ID 12345    // Must match your paired collar
#define SHOCKER_CHANNEL 0               // 0, 1, or 2
```

## Serial Commands (for testing)

Connect at 115200 baud:
- `v` - Test vibrate
- `b` - Test beep
- `s` - Show status (IP, hardware availability)
- `h` - Help

## Development

### Client Development

```bash
cd client
npm run dev   # Starts dev server on http://localhost:5173
```

For local development, the app auto-detects if it's running on localhost vs ESP32 and adjusts WebSocket URL accordingly.

### Firmware Development

```bash
cd firmware
pio run                    # Build
pio run -t upload          # Upload firmware
pio run -t uploadfs        # Upload filesystem
pio device monitor -b 115200  # Serial monitor
```

## Notes

- The ESP32 serves the React app from LittleFS flash storage (~220KB)
- Uses ESPAsyncWebServer for HTTP and WebSocket on the same port
- Device creates its own WiFi access point (no external network needed)
- mDNS allows access via `lipsync.local` hostname
- Hardware (IMU, RF) is optional - device works without them for testing
