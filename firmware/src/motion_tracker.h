#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <MPU6050.h>
#include "config.h"

struct CycleEvent {
    unsigned long duration;  // ms
    float depth;            // degrees
    unsigned long timestamp;
};

class MotionTracker {
public:
    MotionTracker();
    bool begin();
    void update();
    
    // Check if a new cycle was completed
    bool hasCycle();
    CycleEvent getCycle();
    
    // Current readings
    float getPitch() { return _pitch; }
    float getRoll() { return _roll; }
    
private:
    MPU6050 _mpu;
    
    // Current orientation
    float _pitch = 0;
    float _roll = 0;
    
    // Complementary filter state
    float _accelPitch = 0;
    float _gyroPitch = 0;
    unsigned long _lastUpdate = 0;
    
    // Cycle detection
    float _lastPitch = 0;
    float _prevPitch = 0;
    bool _wasIncreasing = false;
    unsigned long _lastPeakTime = 0;
    float _minPitch = 0;
    float _maxPitch = 0;
    
    // Completed cycle storage
    bool _cycleReady = false;
    CycleEvent _lastCycle;
    
    void calculateOrientation(int16_t ax, int16_t ay, int16_t az,
                              int16_t gx, int16_t gy, int16_t gz);
    bool detectPeak();
};

// Implementation

MotionTracker::MotionTracker() {}

bool MotionTracker::begin() {
    Wire.begin(IMU_SDA_PIN, IMU_SCL_PIN);
    
    _mpu.initialize();
    
    if (!_mpu.testConnection()) {
        Serial.println("MPU6050 connection failed!");
        return false;
    }
    
    // Configure MPU6050
    _mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_500);  // ±500°/s
    _mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_4);  // ±4g
    _mpu.setDLPFMode(MPU6050_DLPF_BW_42);  // Low pass filter
    
    _lastUpdate = millis();
    Serial.println("Motion Tracker initialized");
    return true;
}

void MotionTracker::calculateOrientation(int16_t ax, int16_t ay, int16_t az,
                                         int16_t gx, int16_t gy, int16_t gz) {
    unsigned long now = millis();
    float dt = (now - _lastUpdate) / 1000.0f;
    _lastUpdate = now;
    
    // Convert raw values
    float accelX = ax / 8192.0f;  // ±4g scale
    float accelY = ay / 8192.0f;
    float accelZ = az / 8192.0f;
    float gyroX = gx / 65.5f;     // ±500°/s scale
    
    // Calculate pitch from accelerometer
    _accelPitch = atan2(accelX, sqrt(accelY * accelY + accelZ * accelZ)) * 180.0f / PI;
    
    // Integrate gyroscope
    _gyroPitch = _pitch + gyroX * dt;
    
    // Complementary filter (98% gyro, 2% accel)
    _pitch = 0.98f * _gyroPitch + 0.02f * _accelPitch;
    
    // Calculate roll (for debugging/display)
    _roll = atan2(accelY, accelZ) * 180.0f / PI;
}

bool MotionTracker::detectPeak() {
    bool isIncreasing = _pitch > _lastPitch;
    bool directionChanged = (_wasIncreasing && !isIncreasing) || (!_wasIncreasing && isIncreasing);
    
    // Check if movement is significant
    float movement = abs(_pitch - _prevPitch);
    
    _prevPitch = _lastPitch;
    _lastPitch = _pitch;
    _wasIncreasing = isIncreasing;
    
    return directionChanged && movement > PEAK_THRESHOLD;
}

void MotionTracker::update() {
    int16_t ax, ay, az, gx, gy, gz;
    _mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    
    calculateOrientation(ax, ay, az, gx, gy, gz);
    
    // Track min/max for depth
    _minPitch = min(_minPitch, _pitch);
    _maxPitch = max(_maxPitch, _pitch);
    
    // Check for peak (direction change)
    if (detectPeak()) {
        unsigned long now = millis();
        unsigned long cycleTime = now - _lastPeakTime;
        
        // Valid cycle?
        if (cycleTime >= MIN_CYCLE_TIME && cycleTime <= MAX_CYCLE_TIME && _lastPeakTime > 0) {
            _lastCycle.duration = cycleTime;
            _lastCycle.depth = _maxPitch - _minPitch;
            _lastCycle.timestamp = now;
            _cycleReady = true;
        }
        
        // Reset for next cycle
        _lastPeakTime = now;
        _minPitch = _pitch;
        _maxPitch = _pitch;
    }
}

bool MotionTracker::hasCycle() {
    return _cycleReady;
}

CycleEvent MotionTracker::getCycle() {
    _cycleReady = false;
    return _lastCycle;
}
