# LipSync

A rhythm-guided training system with haptic feedback. Turn oral service into a game they *really* don't want to lose.

Your sub follows a wave pattern on their phone while wearing an RF shock collar. Fall out of rhythm? They get a reminder. You control the pace.

Everything runs on a single ESP32 - no cloud, no apps to install, completely self-contained.

![LipSync Screenshot](images/screenshot.png)

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
- **Deep sleep** - Automatically sleeps after 1 minute of inactivity to save battery

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
| Seeed XIAO ESP32C3 | Compact ESP32-C3 board | 1 | $5-10 | Built-in LiPo charging |
| 3.7V LiPo Battery | 400-1000mAh | 1 | $5-10 | Connects to BAT+/BAT- pads |
| 433MHz RF Transmitter | FS1000A or similar | 1 | $2-5 | For collar control |
| RF Shock Collar | CaiXianlin protocol (common on Amazon/AliExpress) | 1 | $20-40 | The cheap ones with 3 channels |
| MPU6050 IMU | GY-521 module | 1 | $2-5 | Optional - for motion tracking |
| Tactile Button | 6x6mm momentary switch | 1 | $1 | Reset/wake button |
| LEDs | 3mm or 5mm, any color | 2 | $1 | Status indicators |
| Resistors | 220Ω (1/4W) | 2 | $1 | For LEDs |
| Enclosure | 3D printed or project box | 1 | $5 | Optional - STL files included |

**Total cost: ~$40-80** (depending on what you already have)

### Where to Buy

- **XIAO ESP32C3**: [Seeed Studio](https://www.seeedstudio.com/Seeed-XIAO-ESP32C3-p-5431.html), Amazon, AliExpress
- **RF Transmitter**: Search "433MHz transmitter module FS1000A"
- **Shock Collar**: Search "dog training collar 433MHz" - look for ones with vibrate/beep/shock modes
- **MPU6050**: Search "MPU6050 GY-521 module"
- **LiPo Battery**: Any 3.7V LiPo with JST connector (400-1000mAh recommended)

## Wiring

```
XIAO Pin      Component
──────────    ─────────
D10 (GPIO10)  RF Transmitter DATA
D4 (GPIO6)    MPU6050 SDA (optional)
D5 (GPIO7)    MPU6050 SCL (optional)
D0 (GPIO2)    Green LED → 220Ω → GND (connection status)
D3 (GPIO5)    Red LED → 220Ω → GND (session status)
D1 (GPIO3)    Button → GND (reset/wake, hold 1s)
3.3V          RF Transmitter VCC, MPU6050 VCC
GND           RF Transmitter GND, MPU6050 GND
BAT+/BAT-     3.7V LiPo battery
```

**Note**: RF range is reduced at 3.3V but sufficient for close range use. The XIAO charges the LiPo via USB-C.


![LipSync PCB](images/PCB.png)
![LipSync Enclosure](images/Enclosure.png)

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

# Upload to XIAO ESP32C3
cd ../firmware
pio run -t upload -e seeed_xiao_esp32c3      # Upload firmware
pio run -t uploadfs -e seeed_xiao_esp32c3    # Upload web files
pio device monitor -b 115200                  # Monitor serial output
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
pio run -e seeed_xiao_esp32c3                 # Build
pio run -t upload -e seeed_xiao_esp32c3       # Upload firmware
pio run -t uploadfs -e seeed_xiao_esp32c3     # Upload web files
pio device monitor -b 115200                   # Serial monitor
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

## Power Management

The device automatically enters deep sleep after 1 minute of inactivity (no connected client and no active session) to conserve battery. Press the button to wake it up - LEDs will blink 3 times on boot.

Activity that resets the idle timer:
- Button press
- WebSocket client connecting
- WebSocket messages received
- Motion detected (cycles)

## Troubleshooting

### Can't connect to WiFi
- Make sure you're connecting to "LipSync" network
- Password is `lipsync123`
- Try `http://192.168.4.1` if `.local` doesn't work

### Collar not responding
- Check RF transmitter wiring (DATA to D10/GPIO10)
- Use serial monitor to confirm signals are being sent
- Ensure collar is paired (see pairing instructions above)

### Upload fails
- Try a different USB cable (must be data, not charge-only)
- Close any serial monitors first
- Make sure you're using `-e seeed_xiao_esp32c3`

### Web app not loading
- Make sure filesystem was uploaded: `pio run -t uploadfs -e seeed_xiao_esp32c3`
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
