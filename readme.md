# LipSync

A rhythm-guided training system with haptic feedback. Turn oral service into a game they *really* don't want to lose.

Your sub follows a wave pattern on their phone while wearing an RF shock collar. Fall out of rhythm? They get a reminder. You control the pace.

Everything runs on a single ESP32 - no cloud, no apps to install, completely self-contained.

![LipSync Screenshot](screenshots/screenshot.png)

## Features

- **Visual guidance** - Smooth wave pattern shows the target rhythm
- **Audio cues** - High/low beeps signal direction changes
- **Adjustable pace** - Slide to control speed in real-time
- **Escalating feedback** - Starts gentle, increases with repeated mistakes
- **Shock collar integration** - Works with cheap 433MHz RF collars
- **Hold modes** - Special modes for deepthroat and kiss/lick
- **Motion tracking** - Optional IMU shows their actual movement vs target
- **No internet required** - Works completely offline
- **Mobile-first UI** - Designed for phones and tablets

## How It Works

```
┌──────────────────┐         ┌──────────────────────────────────┐
│   Phone/Tablet   │         │         ESP32 Device             │
│    (Browser)     │◄───────►│                                  │
│                  │  WiFi   │  - Web server (serves React app) │
│  Opens:          │         │  - WebSocket (real-time comms)   │
│  lipsync.local   │         │  - RF transmitter (collar ctrl)  │
│                  │         │  - MPU6050 IMU (motion tracking) │
└──────────────────┘         └──────────────────────────────────┘
```

The ESP32 creates its own WiFi network. Connect your phone, open the browser, and you're ready to play.

## Bill of Materials

| Component | Description | Qty | Approx. Price | Notes |
|-----------|-------------|-----|---------------|-------|
| ESP32 Dev Board | ESP-WROOM-32 with CH340C USB | 1 | $5-10 | Any ESP32 devkit works |
| 433MHz RF Transmitter | FS1000A or similar | 1 | $2-5 | For collar control |
| RF Shock Collar | CaiXianlin protocol (common on Amazon/AliExpress) | 1 | $20-40 | The cheap ones with 3 channels |
| MPU6050 IMU | 6-axis accelerometer/gyro | 1 | $2-5 | Optional - for motion tracking |
| Jumper Wires | Female-to-female | ~10 | $2 | For connections |
| USB Cable | Micro-USB or USB-C (depends on board) | 1 | $3 | Data cable, not charge-only |
| Enclosure | 3D printed or project box | 1 | $5 | Optional - STL files included |

**Total cost: ~$35-70** (depending on what you already have)

### Where to Buy

- **ESP32**: Amazon, AliExpress, or electronics suppliers like Adafruit/SparkFun
- **RF Transmitter**: Search "433MHz transmitter module FS1000A"
- **Shock Collar**: Search "dog training collar 433MHz" - look for ones with vibrate/beep/shock modes
- **MPU6050**: Search "MPU6050 GY-521 module"

## Wiring

```
ESP32 Pin    Component
─────────    ─────────
GPIO 15  →   RF Transmitter DATA
GPIO 21  →   MPU6050 SDA (optional)
GPIO 22  →   MPU6050 SCL (optional)
3.3V     →   RF Transmitter VCC, MPU6050 VCC
GND      →   RF Transmitter GND, MPU6050 GND
```

**Note**: Some RF transmitters work better with 5V. If range is poor, try connecting VCC to the 5V pin instead.

## Quick Start

### 1. Flash the Firmware

```bash
# Install PlatformIO
brew install platformio   # macOS
# or: pip install platformio

# Clone and build
git clone https://github.com/yourusername/lipsync.git
cd lipsync/client
npm install
npm run build
cp -r dist/* ../firmware/data/

cd ../firmware
pio run -t upload -e esp32dev      # Upload firmware (hold BOOT button)
pio run -t uploadfs -e esp32dev    # Upload web files
```

### 2. Connect and Play

1. Power on the ESP32
2. Connect to the "LipSync" WiFi network (password: `lipsync123`)
3. Open `http://lipsync.local` in your browser (or `http://192.168.4.1`)
4. Tap "Play" to begin!

### 3. Pairing the collar

Collars can be put into pairing mode by pressing the power button for ~2 seconds. There will be a beep, and the light will flash continuously.
To pair, send a "beep" signal from the app (open the settings cog and click the "Beep" button)

## Usage

### Main Controls

- **Speed Slider** (right side) - Drag up/down to control pace
- **Start/Pause** - Begin or pause the session
- **Hold/Kiss** - Quick buttons for hold modes

### Settings (gear icon)

- **Punishment Mode**: Beep, Vibrate, or Shock
- **Max Intensity**: Limit for shock strength
- **Increasing Intensity**: Start low, escalate with mistakes

### How Feedback Works

1. **Grace period** after speed changes - time to adjust
2. **First mistake** at a given speed - warning vibration
3. **Repeated mistakes** - shock at current intensity
4. **Each punishment** - intensity increases (if enabled)
5. **Speed change** - resets warning, gives grace period

## Development

### Local Web Development

```bash
cd client
npm run dev    # Starts at http://localhost:5173
```

### Firmware Development

```bash
cd firmware
pio run                           # Build
pio run -t upload                 # Upload
pio device monitor -b 115200      # Serial monitor
```

### Serial Commands

Connect at 115200 baud for debugging:
- `v` - Test vibrate
- `b` - Test beep
- `s` - Show status
- `h` - Help

## Project Structure

```
lipsync/
├── client/                 # React web app (Vite + TypeScript)
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── context/        # State management
│   │   ├── hooks/          # useWebSocket, useAudio
│   │   └── styles/         # CSS
│   └── package.json
├── firmware/               # ESP32 firmware (PlatformIO)
│   ├── src/main.cpp        # Main firmware
│   ├── include/            # Headers (config, RF, IMU)
│   ├── data/               # Built web files (LittleFS)
│   └── platformio.ini
├── enclosure/              # 3D printable enclosure STLs
└── screenshots/
```

## Troubleshooting

### Can't connect to WiFi
- Make sure you're connecting to "LipSync" network
- Password is `lipsync123`
- Try `http://192.168.4.1` if `.local` doesn't work

### Collar not responding
- Check RF transmitter wiring (DATA to GPIO 15)
- Try 5V instead of 3.3V for the transmitter
- Use serial monitor to confirm signals are being sent

### Upload fails
- Hold the BOOT button when upload starts
- Try a different USB cable (must be data, not charge-only)
- Close any serial monitors first

### Web app not loading
- Make sure filesystem was uploaded: `pio run -t uploadfs`
- Check serial output for errors

## Safety

This project involves shock collars. Please:
- **Always have a safeword** and a way to immediately stop
- **Test intensity on yourself first** before using on a partner
- **Start at low intensity** and increase gradually
- **Never use on anyone with a heart condition** or pacemaker
- **Remove if any unusual reaction occurs**
- This is for **consensual adult play only**

## Contributing

PRs welcome! Some ideas for improvements:
- [ ] Bluetooth collar support
- [ ] Pattern presets (slow build, random, etc.)
- [ ] Multi-sub support
- [ ] Session statistics/scoring
- [ ] OTA firmware updates

## License

MIT License - do whatever you want with it.

## Acknowledgments

- Built with [PlatformIO](https://platformio.org/), [React](https://react.dev/), [Vite](https://vitejs.dev/)
- RF protocol reverse-engineered from CaiXianlin collar remotes
- Massive props to Openshock for their work with the RF collars
- Thanks to some random guy off reddit for the idea
- Inspired by too many late nights and questionable life choices
