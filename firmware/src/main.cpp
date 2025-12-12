#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include "config.h"
#include "rf_transmitter.h"
#include "motion_tracker.h"

// Components
RFTransmitter rf(RF_TX_PIN);
MotionTracker motion;
AsyncWebServer server(WS_PORT);
AsyncWebSocket ws("/ws");
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

// Connected client (we only support one at a time)
AsyncWebSocketClient* connectedClient = nullptr;

// Timing
unsigned long lastSample = 0;
unsigned long lastBlink = 0;
const unsigned long SAMPLE_INTERVAL = 1000 / IMU_SAMPLE_RATE;
const unsigned long BLINK_INTERVAL = 1000;

// Forward declarations
void handleWebSocketMessage(void* arg, uint8_t* data, size_t len);
void onWsEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len);
void evaluateAndFeedback(const CycleEvent& cycle);
void broadcastState();
void sendToClient(const String& json);

// List directory recursively
void listDir(fs::FS &fs, const char* dirname, uint8_t levels) {
    Serial.printf("Listing directory: %s\n", dirname);
    File root = fs.open(dirname);
    if (!root || !root.isDirectory()) {
        Serial.println("  Failed to open directory");
        return;
    }
    File file = root.openNextFile();
    while (file) {
        if (file.isDirectory()) {
            Serial.printf("  DIR: %s\n", file.path());
            if (levels) {
                listDir(fs, file.path(), levels - 1);
            }
        } else {
            Serial.printf("  FILE: %s (%d bytes)\n", file.path(), file.size());
        }
        file = root.openNextFile();
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n\n=== Motion Trainer Firmware (Web Server Mode) ===");

    // Status LED
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, HIGH);

    // Initialize LittleFS
    if (!LittleFS.begin(true)) {
        Serial.println("LittleFS mount failed!");
    } else {
        Serial.println("LittleFS mounted");
        // List all files recursively
        listDir(LittleFS, "/", 3);
    }

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
    WiFiManagerParameter customTxId("txid", "Transmitter ID", String(session.transmitterId).c_str(), 6);
    WiFiManagerParameter customChannel("channel", "Channel (0-2)", String(session.channel).c_str(), 2);

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
    session.transmitterId = atoi(customTxId.getValue());
    session.channel = atoi(customChannel.getValue()) % 3;

    Serial.printf("Connected to WiFi: %s\n", WiFi.SSID().c_str());
    Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Transmitter ID: %d, Channel: %d\n", session.transmitterId, session.channel);

    // Start mDNS
    if (MDNS.begin(MDNS_HOSTNAME)) {
        Serial.printf("mDNS started: http://%s.local\n", MDNS_HOSTNAME);
        MDNS.addService("http", "tcp", WS_PORT);
    } else {
        Serial.println("mDNS failed to start");
    }

    // Setup WebSocket handler
    ws.onEvent(onWsEvent);
    server.addHandler(&ws);

    // Serve static files from LittleFS with correct MIME types
    server.on("/assets/index.js", HTTP_GET, [](AsyncWebServerRequest* request) {
        Serial.println("Request for /assets/index.js");
        if (LittleFS.exists("/assets/index.js")) {
            Serial.println("  File exists!");
            request->send(LittleFS, "/assets/index.js", "application/javascript");
        } else {
            Serial.println("  File NOT found!");
            request->send(404, "text/plain", "File not found");
        }
    });
    server.on("/assets/index.css", HTTP_GET, [](AsyncWebServerRequest* request) {
        Serial.println("Request for /assets/index.css");
        if (LittleFS.exists("/assets/index.css")) {
            Serial.println("  File exists!");
            request->send(LittleFS, "/assets/index.css", "text/css");
        } else {
            Serial.println("  File NOT found!");
            request->send(404, "text/plain", "File not found");
        }
    });

    // Serve other static files
    server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");

    // Handle 404 - serve index.html for SPA routing
    server.onNotFound([](AsyncWebServerRequest* request) {
        Serial.printf("404: %s\n", request->url().c_str());
        if (LittleFS.exists("/index.html")) {
            request->send(LittleFS, "/index.html", "text/html");
        } else {
            request->send(404, "text/plain", "Not found - upload filesystem first");
        }
    });

    // Start server
    server.begin();
    Serial.printf("Web server started on port %d\n", WS_PORT);

    digitalWrite(LED_PIN, LOW);
    Serial.println("Setup complete!");
    Serial.printf("Open: http://%s.local or http://%s\n",
                  MDNS_HOSTNAME,
                  WiFi.localIP().toString().c_str());
}

void loop() {
    // Blink LED - fast when client connected, slow when waiting
    unsigned long blinkRate = connectedClient ? 200 : 1000;
    if (millis() - lastBlink >= blinkRate) {
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
            Serial.printf("RF: %s, IMU: %s, Client: %s\n",
                rfAvailable ? "OK" : "NO",
                imuAvailable ? "OK" : "NO",
                connectedClient ? "CONNECTED" : "NONE");
            Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
            Serial.printf("Transmitter ID: %d, Channel: %d\n", session.transmitterId, session.channel);
        } else if (cmd == "h" || cmd == "help") {
            Serial.println("Commands: v=vibrate, b=beep, s=status, h=help");
        } else if (cmd.length() > 0) {
            Serial.println("Unknown command. Type 'h' for help.");
        }
    }

    // Clean up disconnected WebSocket clients
    ws.cleanupClients();

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

            // Send cycle data to client
            if (connectedClient) {
                JsonDocument doc;
                doc["type"] = "cycle";
                doc["data"]["duration"] = cycle.duration;
                doc["data"]["depth"] = cycle.depth;
                doc["data"]["timestamp"] = cycle.timestamp;

                String json;
                serializeJson(doc, json);
                sendToClient(json);
            }
        }
    }
}

void onWsEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT:
            Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
            connectedClient = client;
            broadcastState();
            break;

        case WS_EVT_DISCONNECT:
            Serial.printf("WebSocket client #%u disconnected\n", client->id());
            if (connectedClient == client) {
                connectedClient = nullptr;
                session.active = false;  // Safety: stop session on disconnect
            }
            break;

        case WS_EVT_DATA:
            handleWebSocketMessage(arg, data, len);
            break;

        case WS_EVT_PONG:
        case WS_EVT_ERROR:
            break;
    }
}

void handleWebSocketMessage(void* arg, uint8_t* data, size_t len) {
    AwsFrameInfo* info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        data[len] = 0;  // Null terminate

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, (char*)data);

        if (error) {
            Serial.printf("JSON parse error: %s\n", error.c_str());
            return;
        }

        const char* type = doc["type"];
        Serial.printf("Received: %s\n", type);

        if (strcmp(type, "start") == 0) {
            session.active = true;
            Serial.println("Session STARTED");

            // Beep to confirm
            if (rfAvailable) {
                rf.beep(session.transmitterId, session.channel);
            }

            JsonDocument response;
            response["type"] = "sessionStarted";
            String json;
            serializeJson(response, json);
            sendToClient(json);

        } else if (strcmp(type, "stop") == 0) {
            session.active = false;
            Serial.println("Session STOPPED");

            // Beep to confirm
            if (rfAvailable) {
                rf.beep(session.transmitterId, session.channel);
            }

            JsonDocument response;
            response["type"] = "sessionStopped";
            String json;
            serializeJson(response, json);
            sendToClient(json);

        } else if (strcmp(type, "setTargets") == 0) {
            if (doc["data"]["paceBPM"].is<int>())
                session.targetBPM = doc["data"]["paceBPM"];
            if (doc["data"]["depthDegrees"].is<int>())
                session.targetDepth = doc["data"]["depthDegrees"];
            if (doc["data"]["tolerance"].is<float>())
                session.tolerance = doc["data"]["tolerance"];

            Serial.printf("Targets: BPM=%d, Depth=%d, Tol=%.2f\n",
                          session.targetBPM, session.targetDepth, session.tolerance);

            JsonDocument response;
            response["type"] = "targetsUpdated";
            response["data"]["paceBPM"] = session.targetBPM;
            response["data"]["depthDegrees"] = session.targetDepth;
            response["data"]["tolerance"] = session.tolerance;
            String json;
            serializeJson(response, json);
            sendToClient(json);

        } else if (strcmp(type, "setIntensity") == 0) {
            if (doc["data"]["intensity"].is<int>())
                session.intensity = doc["data"]["intensity"];

            Serial.printf("Intensity: %d\n", session.intensity);

        } else if (strcmp(type, "setTransmitter") == 0) {
            if (doc["data"]["transmitterId"].is<int>())
                session.transmitterId = doc["data"]["transmitterId"];
            if (doc["data"]["channel"].is<int>())
                session.channel = doc["data"]["channel"].as<int>() % 3;

            Serial.printf("Transmitter: ID=%d, Channel=%d\n", session.transmitterId, session.channel);

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

        } else if (strcmp(type, "getState") == 0) {
            broadcastState();
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

    // Calculate current BPM
    float currentBPM = 60000.0f / cycle.duration;

    // Send result to client
    if (connectedClient) {
        JsonDocument doc;
        doc["type"] = "cycleResult";
        doc["data"]["currentBPM"] = (int)currentBPM;
        doc["data"]["currentDepth"] = (int)cycle.depth;
        doc["data"]["paceDeviation"] = paceDeviation;
        doc["data"]["depthDeviation"] = depthDeviation;
        doc["data"]["deviation"] = deviation;
        doc["data"]["feedback"] = deviation > session.tolerance;

        String json;
        serializeJson(doc, json);
        sendToClient(json);
    }

    // Debug output
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

void broadcastState() {
    if (!connectedClient) return;

    JsonDocument doc;
    doc["type"] = "state";
    doc["data"]["active"] = session.active;
    doc["data"]["targets"]["paceBPM"] = session.targetBPM;
    doc["data"]["targets"]["depthDegrees"] = session.targetDepth;
    doc["data"]["targets"]["tolerance"] = session.tolerance;
    doc["data"]["feedbackIntensity"] = session.intensity;
    doc["data"]["transmitterId"] = session.transmitterId;
    doc["data"]["channel"] = session.channel;
    doc["data"]["rfAvailable"] = rfAvailable;
    doc["data"]["imuAvailable"] = imuAvailable;

    String json;
    serializeJson(doc, json);
    sendToClient(json);
}

void sendToClient(const String& json) {
    if (connectedClient) {
        connectedClient->text(json);
    }
}
