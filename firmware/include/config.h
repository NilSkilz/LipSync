#pragma once

// ============================================
// PIN CONFIGURATION
// ============================================

// RF Transmitter pin (433MHz)
#ifndef RF_TX_PIN
#define RF_TX_PIN 15
#endif

// IMU I2C pins (MPU6050)
#ifndef IMU_SDA_PIN
#define IMU_SDA_PIN 21
#endif

#ifndef IMU_SCL_PIN
#define IMU_SCL_PIN 22
#endif

// Status LED
#ifndef LED_PIN
#define LED_PIN 2
#endif

// ============================================
// SERVER CONFIGURATION
// ============================================

// Default WebSocket server (override via WiFiManager)
#define DEFAULT_SERVER_HOST "motion-trainer-server-production.up.railway.app"
#define DEFAULT_SERVER_PORT 443
#define DEFAULT_SERVER_PATH "/sensor"
#define DEFAULT_USE_SSL true

// ============================================
// SHOCKER CONFIGURATION
// ============================================

// CaiXianlin protocol
#define SHOCKER_TRANSMITTER_ID 12345  // Change this! Must match your paired collar
#define SHOCKER_CHANNEL 0             // 0, 1, or 2

// ============================================
// MOTION DETECTION
// ============================================

// IMU sample rate (Hz)
#define IMU_SAMPLE_RATE 50

// Minimum angle change to detect a peak (degrees)
#define PEAK_THRESHOLD 3.0

// Minimum cycle time (ms) - prevents noise
#define MIN_CYCLE_TIME 200

// Maximum cycle time (ms) - prevents stale readings
#define MAX_CYCLE_TIME 5000

// ============================================
// FEEDBACK DEFAULTS
// ============================================

#define DEFAULT_TARGET_BPM 60
#define DEFAULT_TARGET_DEPTH 30
#define DEFAULT_TOLERANCE 0.3
#define DEFAULT_INTENSITY 50
