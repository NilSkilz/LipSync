# Motion Trainer

A self-contained motion training device with real-time haptic feedback. Everything runs on a single ESP32 - no cloud server required.

## How It Works

```
┌──────────────────┐         ┌──────────────────────────────────┐
│   Phone/Tablet   │         │         ESP32 Device             │
│    (Browser)     │◄───────►│                                  │
│                  │  WiFi   │  - Web server (serves React app) │
│  Opens:          │         │  - WebSocket (real-time comms)   │
│  motiontrainer   │         │  - RF transmitter (collar ctrl)  │
│  .local          │         │  - MPU6050 IMU (motion tracking) │
└──────────────────┘         └──────────────────────────────────┘
```

Your phone connects directly to the ESP32 over WiFi. The ESP32 serves the web app from its flash storage and handles all the hardware control.

## Quick Start

1. Power on the ESP32
2. Connect to "MotionTrainer-Setup" WiFi to configure your network
3. Open `http://motiontrainer.local` in your browser
4. Start training!

## Project Structure

```
motion-trainer/
├── client/                 # React web app
│   ├── src/
│   │   ├── components/     # UI components (WaveCanvas, SpeedControl, etc.)
│   │   ├── context/        # State management
│   │   ├── hooks/          # useWebSocket, useAudio
│   │   └── styles/         # CSS
│   └── package.json
├── firmware/               # ESP32 firmware (PlatformIO)
│   ├── src/main.cpp        # Main firmware code
│   ├── data/               # Built web files go here (for upload to ESP32)
│   └── platformio.ini      # Build configuration
└── screenshots/            # Reference images
```

## Updating the Device

When you make changes to the web app or firmware, you need to upload them to the ESP32.

### Prerequisites

```bash
# Install PlatformIO CLI (macOS)
brew install platformio

# Install client dependencies
cd client
npm install
```

### Update Web App Only

If you only changed the React app (client code):

```bash
# 1. Build the React app
cd client
npm run build

# 2. Copy built files to firmware data folder
cp -r dist/* ../firmware/data/

# 3. Upload to ESP32 filesystem
cd ../firmware
pio run -t uploadfs -e esp32dev
```

### Update Firmware Only

If you only changed the ESP32 code (firmware/src):

```bash
cd firmware
pio run -t upload -e esp32dev
```

Note: You may need to hold the BOOT button on the ESP32 when uploading starts.

### Update Both

```bash
# Build and copy web app
cd client
npm run build
cp -r dist/* ../firmware/data/

# Upload everything
cd ../firmware
pio run -t upload -e esp32dev      # Firmware
pio run -t uploadfs -e esp32dev    # Web files
```

### Monitor Serial Output

To see debug output from the ESP32:

```bash
cd firmware
pio device monitor -b 115200
```

## Development

### Local Web Development

You can develop the web app without the ESP32:

```bash
cd client
npm run dev
```

This starts a dev server at `http://localhost:5173`. The app detects it's running locally and disables WebSocket connections, so you can test the UI.

### Firmware Development

```bash
cd firmware
pio run                    # Build only
pio run -t upload          # Build and upload
```

## Hardware

### Required
- ESP32 Dev Board (ESP-WROOM-32 with CH340C USB-serial)

### Optional
- **433MHz RF transmitter** (pin 15) - for vibration collar control
- **MPU6050 IMU** (I2C: SDA=21, SCL=22) - for motion tracking

The device works without the optional hardware - useful for testing the app.

## Troubleshooting

### Can't connect to ESP32
- Make sure your phone/computer is on the same WiFi network
- Try the IP address instead of `motiontrainer.local`
- Check serial monitor for the device's IP address

### Upload fails
- Hold the BOOT button on the ESP32 when upload starts
- Try a different USB cable (some are charge-only)
- Make sure no serial monitor is connected

### Web app not loading
- Verify filesystem was uploaded: `pio run -t uploadfs`
- Check serial monitor for errors

## Technical Details

See [CLAUDE.md](CLAUDE.md) for:
- WebSocket protocol documentation
- Configuration options
- Serial commands for testing

## License

MIT
