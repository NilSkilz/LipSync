#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <ArduinoWebsockets.h>
#include <ArduinoJson.h>
#include "config.h"
#include "rf_transmitter.h"
#include "motion_tracker.h"

using namespace websockets;

// Components
RFTransmitter rf(RF_TX_PIN);
MotionTracker motion;
WebsocketsClient ws;
WiFiManager wifiManager;

// Hardware status
bool rfAvailable = false;
bool imuAvailable = false;

// Session state
struct SessionConfig {
    bool active = false;
    int targetBPM = DEFAULT_TARGET_BPM;
    int targetDepth = DEFAULT_TARGET_DEPTH;
    float tolerance = DEFAULT_TOLERANCE;
    int intensity = DEFAULT_INTENSITY;
    uint16_t transmitterId = SHOCKER_TRANSMITTER_ID;
    uint8_t channel = SHOCKER_CHANNEL;
} session;

// Server config (stored in SPIFFS/Preferences)
String serverHost = DEFAULT_SERVER_HOST;
int serverPort = DEFAULT_SERVER_PORT;
String serverPath = DEFAULT_SERVER_PATH;
bool useSSL = DEFAULT_USE_SSL;

// Timing
unsigned long lastSample = 0;
unsigned long lastReconnect = 0;
unsigned long lastBlink = 0;
const unsigned long SAMPLE_INTERVAL = 1000 / IMU_SAMPLE_RATE;
const unsigned long RECONNECT_INTERVAL = 5000;
const unsigned long BLINK_INTERVAL = 1000;

// Forward declarations
void onMessageCallback(WebsocketsMessage message);
void onEventsCallback(WebsocketsEvent event, String data);
void connectWebSocket();
void sendStatus(const char* status);
void evaluateAndFeedback(const CycleEvent& cycle);

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n\n=== Motion Trainer Firmware ===");
    
    // Status LED
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, HIGH);
    
    // Initialize RF transmitter (optional)
    rfAvailable = rf.begin();
    if (!rfAvailable) {
        Serial.println("RF init failed - continuing without RF");
    }

    // Initialize motion tracker (optional)
    imuAvailable = motion.begin();
    if (!imuAvailable) {
        Serial.println("IMU init failed - continuing without IMU");
    }
    
    // WiFi Manager custom parameters
    WiFiManagerParameter customServer("server", "Server Host", serverHost.c_str(), 64);
    WiFiManagerParameter customTxId("txid", "Transmitter ID", String(session.transmitterId).c_str(), 6);
    WiFiManagerParameter customChannel("channel", "Channel (0-2)", String(session.channel).c_str(), 2);
    
    wifiManager.addParameter(&customServer);
    wifiManager.addParameter(&customTxId);
    wifiManager.addParameter(&customChannel);
    
    // Start WiFi Manager
    wifiManager.setConfigPortalTimeout(180);
    
    if (!wifiManager.autoConnect("MotionTrainer-Setup")) {
        Serial.println("WiFi connection failed, restarting...");
        delay(3000);
        ESP.restart();
    }
    
    // Read custom parameters
    serverHost = String(customServer.getValue());
    session.transmitterId = atoi(customTxId.getValue());
    session.channel = atoi(customChannel.getValue()) % 3;
    
    Serial.printf("Connected to WiFi: %s\n", WiFi.SSID().c_str());
    Serial.printf("Server: %s\n", serverHost.c_str());
    Serial.printf("Transmitter ID: %d, Channel: %d\n", session.transmitterId, session.channel);
    
    // WebSocket callbacks
    ws.onMessage(onMessageCallback);
    ws.onEvent(onEventsCallback);
    
    // Initial connection
    connectWebSocket();
    
    digitalWrite(LED_PIN, LOW);
    Serial.println("Setup complete!");
}

void loop() {
    ws.poll();

    // Blink LED every second to show we're alive
    if (millis() - lastBlink >= BLINK_INTERVAL) {
        lastBlink = millis();
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    }

    // Handle serial commands for testing
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        if (cmd == "v" || cmd == "vibrate") {
            Serial.println("Vibrate command (50%)");
            if (rfAvailable) {
                rf.vibrate(session.transmitterId, session.channel, 50);
            } else {
                Serial.println("(RF not available)");
            }
        } else if (cmd == "b" || cmd == "beep") {
            Serial.println("Beep command");
            if (rfAvailable) {
                rf.beep(session.transmitterId, session.channel);
            } else {
                Serial.println("(RF not available)");
            }
        } else if (cmd == "s" || cmd == "status") {
            Serial.printf("RF: %s, IMU: %s, WS: %s\n",
                rfAvailable ? "OK" : "NO",
                imuAvailable ? "OK" : "NO",
                ws.available() ? "CONNECTED" : "DISCONNECTED");
            Serial.printf("Transmitter ID: %d, Channel: %d\n", session.transmitterId, session.channel);
        } else if (cmd == "h" || cmd == "help") {
            Serial.println("Commands: v=vibrate, b=beep, s=status, h=help");
        } else if (cmd.length() > 0) {
            Serial.println("Unknown command. Type 'h' for help.");
        }
    }

    // Reconnect if disconnected
    if (!ws.available() && millis() - lastReconnect > RECONNECT_INTERVAL) {
        connectWebSocket();
        lastReconnect = millis();
    }
    
    // Sample IMU at fixed rate (only if available)
    if (imuAvailable && millis() - lastSample >= SAMPLE_INTERVAL) {
        lastSample = millis();

        motion.update();

        // Check for completed cycle
        if (motion.hasCycle()) {
            CycleEvent cycle = motion.getCycle();

            if (session.active) {
                evaluateAndFeedback(cycle);
            }

            // Send cycle data to server
            if (ws.available()) {
                JsonDocument doc;
                doc["type"] = "cycle";
                doc["data"]["duration"] = cycle.duration;
                doc["data"]["depth"] = cycle.depth;
                doc["data"]["timestamp"] = cycle.timestamp;

                String json;
                serializeJson(doc, json);
                ws.send(json);
            }
        }
    }
}

void connectWebSocket() {
    Serial.printf("Connecting to %s...\n", serverHost.c_str());
    
    String url = (useSSL ? "wss://" : "ws://") + serverHost + serverPath;
    
    if (ws.connect(url)) {
        Serial.println("WebSocket connected!");
        sendStatus("connected");
    } else {
        Serial.println("WebSocket connection failed");
    }
}

void onEventsCallback(WebsocketsEvent event, String data) {
    switch (event) {
        case WebsocketsEvent::ConnectionOpened:
            Serial.println("WS: Connection opened");
            digitalWrite(LED_PIN, LOW);
            break;
        case WebsocketsEvent::ConnectionClosed:
            Serial.println("WS: Connection closed");
            digitalWrite(LED_PIN, HIGH);
            session.active = false;  // Safety: stop on disconnect
            break;
        case WebsocketsEvent::GotPing:
            ws.pong();
            break;
        default:
            break;
    }
}

void onMessageCallback(WebsocketsMessage message) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, message.data());
    
    if (error) {
        Serial.printf("JSON parse error: %s\n", error.c_str());
        return;
    }
    
    const char* type = doc["type"];
    
    if (strcmp(type, "sessionStatus") == 0) {
        session.active = doc["data"]["active"];
        Serial.printf("Session %s\n", session.active ? "STARTED" : "STOPPED");

        // Beep to confirm
        if (rfAvailable) {
            rf.beep(session.transmitterId, session.channel);
        }
        
    } else if (strcmp(type, "config") == 0) {
        // Update configuration
        if (doc["data"]["targetBPM"].is<int>())
            session.targetBPM = doc["data"]["targetBPM"];
        if (doc["data"]["targetDepth"].is<int>())
            session.targetDepth = doc["data"]["targetDepth"];
        if (doc["data"]["tolerance"].is<float>())
            session.tolerance = doc["data"]["tolerance"];
        if (doc["data"]["intensity"].is<int>())
            session.intensity = doc["data"]["intensity"];
        if (doc["data"]["transmitterId"].is<int>())
            session.transmitterId = doc["data"]["transmitterId"];
        if (doc["data"]["channel"].is<int>())
            session.channel = doc["data"]["channel"].as<int>() % 3;
            
        Serial.printf("Config: BPM=%d, Depth=%d, Tol=%.2f, Int=%d\n",
                      session.targetBPM, session.targetDepth, 
                      session.tolerance, session.intensity);
                      
    } else if (strcmp(type, "testVibrate") == 0) {
        int intensity = doc["data"]["intensity"] | 30;
        Serial.printf("Test vibrate: %d%%\n", intensity);
        if (rfAvailable) {
            rf.vibrate(session.transmitterId, session.channel, intensity);
        } else {
            Serial.println("(RF not available)");
        }

    } else if (strcmp(type, "testBeep") == 0) {
        Serial.println("Test beep");
        if (rfAvailable) {
            rf.beep(session.transmitterId, session.channel);
        } else {
            Serial.println("(RF not available)");
        }
    }
}

void evaluateAndFeedback(const CycleEvent& cycle) {
    // Calculate expected duration from target BPM
    float expectedDuration = 60000.0f / session.targetBPM;
    
    // Calculate deviations (0 = perfect, 1 = 100% off)
    float paceDeviation = abs(cycle.duration - expectedDuration) / expectedDuration;
    float depthDeviation = abs(cycle.depth - session.targetDepth) / (float)session.targetDepth;
    
    // Combined deviation (weighted)
    float deviation = (paceDeviation * 0.6f) + (depthDeviation * 0.4f);
    deviation = min(1.0f, deviation);
    
    // Debug output
    float currentBPM = 60000.0f / cycle.duration;
    Serial.printf("Cycle: BPM=%.0f (target %d), Depth=%.0f° (target %d), Dev=%.0f%%\n",
                  currentBPM, session.targetBPM, 
                  cycle.depth, session.targetDepth,
                  deviation * 100);
    
    // Trigger feedback if deviation exceeds tolerance
    if (deviation > session.tolerance) {
        // Scale intensity with deviation
        int feedbackIntensity = session.intensity * (0.5f + deviation * 0.5f);
        feedbackIntensity = min(feedbackIntensity, 100);

        Serial.printf("FEEDBACK: %d%% vibrate\n", feedbackIntensity);
        if (rfAvailable) {
            rf.vibrate(session.transmitterId, session.channel, feedbackIntensity);
        }
    }
}

void sendStatus(const char* status) {
    if (!ws.available()) return;
    
    JsonDocument doc;
    doc["type"] = "status";
    doc["data"]["status"] = status;
    doc["data"]["transmitterId"] = session.transmitterId;
    doc["data"]["channel"] = session.channel;
    
    String json;
    serializeJson(doc, json);
    ws.send(json);
}
