# Motion Trainer Firmware

ESP32 firmware that combines motion sensing (IMU) with direct RF control of shock collars. No cloud dependency for the feedback loop—evaluation happens on-device for minimal latency.

## Architecture

```
┌────────────────────────────────────────────┐
│  ESP32 (worn on headband)                  │
│  ┌─────────┐  ┌─────────┐  ┌────────────┐ │
│  │ MPU6050 │  │ 433MHz  │  │ WebSocket  │ │
│  │  IMU    │  │   TX    │  │  Client    │ │
│  └────┬────┘  └────┬────┘  └─────┬──────┘ │
│       │            │             │         │
│       ▼            │             │         │
│  ┌─────────────────┴─────────────┴───────┐ │
│  │         Motion Evaluator              │ │
│  │  - Detects cycles (peaks)             │ │
│  │  - Compares to targets                │ │
│  │  - Triggers RF on deviation           │ │
│  └───────────────────────────────────────┘ │
└──────────────────┬─────────────────────────┘
                   │ RF 433MHz
                   ▼
            ┌──────────────┐
            │ Shock Collar │
            │ (CaiXianlin) │
            └──────────────┘
```

## Hardware Required

| Component | Example | Notes |
|-----------|---------|-------|
| ESP32 board | Wemos D1 Mini ESP32, Seeed XIAO ESP32S3 | Any ESP32 works |
| IMU | MPU6050 | GY-521 breakout is common |
| 433MHz TX | FS1000A or similar | Must be 433.92MHz ASK/OOK |
| Shock collar | CaiXianlin | From AliExpress, ~$15 |
| Power | USB or LiPo | 3.3V logic |

## Wiring

### ESP32 (default pins)

| ESP32 Pin | Component | Notes |
|-----------|-----------|-------|
| GPIO 15 | RF TX Data | Can change in config.h |
| GPIO 21 | MPU6050 SDA | I2C data |
| GPIO 22 | MPU6050 SCL | I2C clock |
| 3.3V | MPU6050 VCC, RF TX VCC | |
| GND | MPU6050 GND, RF TX GND | |
| GPIO 2 | Status LED | Built-in on most boards |

### Antenna

For best range, attach a 17.3cm wire to the RF TX antenna pin (quarter wavelength for 433MHz).

## Setup

### 1. Install PlatformIO

Install VS Code + PlatformIO extension.

### 2. Configure

Edit `include/config.h`:

```cpp
// Your server URL
#define DEFAULT_SERVER_HOST "your-app.up.railway.app"

// Your collar's transmitter ID (pair first!)
#define SHOCKER_TRANSMITTER_ID 12345
#define SHOCKER_CHANNEL 0
```

### 3. Build & Flash

```bash
# Build
pio run

# Upload
pio run -t upload

# Monitor serial
pio device monitor
```

### 4. WiFi Setup

On first boot (or after reset), the device creates a WiFi AP:
- SSID: `MotionTrainer-Setup`
- Connect and configure WiFi + server settings
- Device will restart and connect

## Pairing the Collar

1. Put collar in pairing mode (hold power 2-3 sec until fast blink)
2. In the phone app, tap "Test Beep"
3. Collar will beep and pair to your transmitter ID

## Protocol

### Server → Sensor

```json
// Start/stop session
{ "type": "sessionStatus", "data": { "active": true } }

// Update config
{ "type": "config", "data": { 
    "targetBPM": 60, 
    "targetDepth": 30, 
    "tolerance": 0.3, 
    "intensity": 50 
}}

// Test commands
{ "type": "testVibrate", "data": { "intensity": 30 } }
{ "type": "testBeep" }
```

### Sensor → Server

```json
// Cycle completed
{ "type": "cycle", "data": { 
    "duration": 980, 
    "depth": 32.5, 
    "timestamp": 1699999999999 
}}

// Status update
{ "type": "status", "data": { 
    "status": "connected",
    "transmitterId": 12345,
    "channel": 0 
}}
```

## Mounting

The sensor should be mounted on a headband or similar, with the IMU oriented so that:
- **Pitch** (forward/back head tilt) is the primary axis being tracked
- Secure mounting prevents the sensor from moving independently

## Troubleshooting

### No RF output
- Check GPIO 15 connection to TX module
- Verify 3.3V power to TX module
- Try adding 10k pulldown resistor on data line

### IMU not detected
- Check I2C connections (SDA/SCL)
- Verify 3.3V power
- Try `i2cdetect` to find device address (should be 0x68)

### WiFi won't connect
- Hold BOOT button during power-on to reset WiFi config
- Check serial output for errors

### Collar not responding
- Verify transmitter ID matches what collar was paired with
- Check channel (0, 1, or 2)
- Re-pair collar if needed
