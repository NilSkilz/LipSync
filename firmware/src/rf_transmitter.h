#pragma once

#include <Arduino.h>
#include "driver/rmt.h"
#include "config.h"

// CaiXianlin RF Protocol timing (microseconds)
#define SYNC_HIGH  1400
#define SYNC_LOW   750
#define ONE_HIGH   750
#define ONE_LOW    250
#define ZERO_HIGH  250
#define ZERO_LOW   750

// Command types
enum class ShockerCommand : uint8_t {
    Shock = 1,
    Vibrate = 2,
    Beep = 3
};

class RFTransmitter {
public:
    RFTransmitter(uint8_t pin = RF_TX_PIN);
    bool begin();
    
    void sendCommand(uint16_t transmitterId, uint8_t channel, 
                     ShockerCommand cmd, uint8_t intensity);
    
    // Convenience methods
    void vibrate(uint16_t transmitterId, uint8_t channel, uint8_t intensity);
    void beep(uint16_t transmitterId, uint8_t channel);
    void shock(uint16_t transmitterId, uint8_t channel, uint8_t intensity);

private:
    uint8_t _pin;
    rmt_channel_t _rmtChannel;
    rmt_item32_t _buffer[44];  // Sync + 40 bits + end
    
    void encodeBit(rmt_item32_t* item, bool bit);
    void encodeSync(rmt_item32_t* item);
    uint8_t calculateChecksum(uint16_t transmitterId, uint8_t channel, 
                              uint8_t cmd, uint8_t intensity);
    void buildPacket(uint16_t transmitterId, uint8_t channel,
                     uint8_t cmd, uint8_t intensity);
};

// Implementation

RFTransmitter::RFTransmitter(uint8_t pin) : _pin(pin), _rmtChannel(RMT_CHANNEL_0) {}

bool RFTransmitter::begin() {
    rmt_config_t config = RMT_DEFAULT_CONFIG_TX((gpio_num_t)_pin, _rmtChannel);
    config.clk_div = 80;  // 1 tick = 1 microsecond (80MHz / 80)
    
    esp_err_t err = rmt_config(&config);
    if (err != ESP_OK) {
        Serial.printf("RMT config failed: %d\n", err);
        return false;
    }
    
    err = rmt_driver_install(_rmtChannel, 0, 0);
    if (err != ESP_OK) {
        Serial.printf("RMT driver install failed: %d\n", err);
        return false;
    }
    
    Serial.println("RF Transmitter initialized");
    return true;
}

void RFTransmitter::encodeSync(rmt_item32_t* item) {
    item->duration0 = SYNC_HIGH;
    item->level0 = 1;
    item->duration1 = SYNC_LOW;
    item->level1 = 0;
}

void RFTransmitter::encodeBit(rmt_item32_t* item, bool bit) {
    if (bit) {
        item->duration0 = ONE_HIGH;
        item->level0 = 1;
        item->duration1 = ONE_LOW;
        item->level1 = 0;
    } else {
        item->duration0 = ZERO_HIGH;
        item->level0 = 1;
        item->duration1 = ZERO_LOW;
        item->level1 = 0;
    }
}

uint8_t RFTransmitter::calculateChecksum(uint16_t transmitterId, uint8_t channel,
                                         uint8_t cmd, uint8_t intensity) {
    // Build the 40-bit payload (without checksum)
    // transmitterId(16) + channel(4) + cmd(4) + intensity(8) = 32 bits + 8 checksum
    uint32_t sum = 0;
    sum += (transmitterId >> 8) & 0xFF;    // High byte of transmitter ID
    sum += transmitterId & 0xFF;            // Low byte of transmitter ID
    sum += (channel << 4) | (cmd & 0x0F);   // Channel + command nibbles
    sum += intensity;
    return sum & 0xFF;
}

void RFTransmitter::buildPacket(uint16_t transmitterId, uint8_t channel,
                                uint8_t cmd, uint8_t intensity) {
    int idx = 0;
    
    // Sync preamble
    encodeSync(&_buffer[idx++]);
    
    // Transmitter ID (16 bits, MSB first)
    for (int i = 15; i >= 0; i--) {
        encodeBit(&_buffer[idx++], (transmitterId >> i) & 1);
    }
    
    // Channel (4 bits)
    for (int i = 3; i >= 0; i--) {
        encodeBit(&_buffer[idx++], (channel >> i) & 1);
    }
    
    // Command (4 bits)
    for (int i = 3; i >= 0; i--) {
        encodeBit(&_buffer[idx++], (cmd >> i) & 1);
    }
    
    // Intensity (8 bits)
    for (int i = 7; i >= 0; i--) {
        encodeBit(&_buffer[idx++], (intensity >> i) & 1);
    }
    
    // Checksum (8 bits)
    uint8_t checksum = calculateChecksum(transmitterId, channel, cmd, intensity);
    for (int i = 7; i >= 0; i--) {
        encodeBit(&_buffer[idx++], (checksum >> i) & 1);
    }
    
    // End marker (zero bit)
    encodeBit(&_buffer[idx++], 0);
}

void RFTransmitter::sendCommand(uint16_t transmitterId, uint8_t channel,
                                ShockerCommand cmd, uint8_t intensity) {
    // Clamp values
    channel = min(channel, (uint8_t)2);
    intensity = min(intensity, (uint8_t)99);
    
    // Beep should have 0 intensity
    if (cmd == ShockerCommand::Beep) {
        intensity = 0;
    }
    
    buildPacket(transmitterId, channel, static_cast<uint8_t>(cmd), intensity);
    
    // Send multiple times for reliability
    for (int i = 0; i < 5; i++) {
        rmt_write_items(_rmtChannel, _buffer, 44, true);
        delayMicroseconds(500);
    }
}

void RFTransmitter::vibrate(uint16_t transmitterId, uint8_t channel, uint8_t intensity) {
    sendCommand(transmitterId, channel, ShockerCommand::Vibrate, intensity);
}

void RFTransmitter::beep(uint16_t transmitterId, uint8_t channel) {
    sendCommand(transmitterId, channel, ShockerCommand::Beep, 0);
}

void RFTransmitter::shock(uint16_t transmitterId, uint8_t channel, uint8_t intensity) {
    sendCommand(transmitterId, channel, ShockerCommand::Shock, intensity);
}
