#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include "config.h"
#include "rf_transmitter.h"
#include "motion_tracker.h"
#include "esp_sleep.h"

// Components
RFTransmitter rf(RF_TX_PIN);
MotionTracker motion;
AsyncWebServer server(WS_PORT);
AsyncWebSocket ws("/ws");

// Hardware status
bool rfAvailable = false;
bool imuAvailable = false;

// Deep sleep
const unsigned long IDLE_SLEEP_TIMEOUT = 1 * 60 * 1000; // 1 minute idle timeout
unsigned long lastActivityTime = 0;

// Punishment modes
enum PunishmentMode { PUNISHMENT_OFF = 0, PUNISHMENT_BEEP = 1, PUNISHMENT_VIBRATE = 2, PUNISHMENT_SHOCK = 3 };

// Session modes (normal = motion tracking, others = hold positions)
enum SessionMode { MODE_NORMAL = 0, MODE_KISS_LICK = 1, MODE_DEEPTHROAT = 2 };

// Session state
struct SessionConfig {
    bool active = false;
    int targetBPM = DEFAULT_TARGET_BPM;
    int targetDepth = DEFAULT_TARGET_DEPTH;
    float tolerance = DEFAULT_TOLERANCE;
    int intensity = DEFAULT_INTENSITY;
    int maxIntensity = DEFAULT_INTENSITY;  // Maximum intensity cap
    bool increasingIntensity = true;       // Start low and increase
    int currentIntensity = 10;             // Current level (when increasing)
    uint16_t transmitterId = SHOCKER_TRANSMITTER_ID;
    uint8_t channel = SHOCKER_CHANNEL;
    int graceCycles = 0;  // Cycles to skip feedback after target change
    PunishmentMode punishmentMode = PUNISHMENT_VIBRATE;
    bool shockWarningGiven = false;  // For shock mode: one warning per speed
    SessionMode sessionMode = MODE_NORMAL;  // Current session mode
} session;

const int INTENSITY_START = 10;      // Starting intensity when increasing
const int INTENSITY_INCREMENT = 5;   // How much to increase each time

const int GRACE_PERIOD_CYCLES = 3;

// Connected client (we only support one at a time)
AsyncWebSocketClient* connectedClient = nullptr;

// Timing
unsigned long lastSample = 0;
unsigned long lastBlink = 0;
unsigned long lastCycleTime = 0;
unsigned long lastPitchBroadcast = 0;
unsigned long buttonPressStart = 0;
const unsigned long SAMPLE_INTERVAL = 1000 / IMU_SAMPLE_RATE;
const unsigned long BLINK_INTERVAL = 1000;
const unsigned long PITCH_BROADCAST_INTERVAL = 20;  // Send pitch every 20ms (50Hz, matches IMU)
const int STALL_CYCLE_COUNT = 3;  // Feedback after this many missed cycles
const unsigned long BUTTON_HOLD_TIME = 1000;  // Hold button 1 second to reset

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

void enterDeepSleep() {
    Serial.println("Entering deep sleep...");

    // Turn off LEDs
    digitalWrite(LED_PIN, LOW);
    digitalWrite(LED2_PIN, LOW);

    // Stop services cleanly
    WiFi.mode(WIFI_OFF);
    btStop();

    // Wake on button press (D1 = GPIO3, active LOW)
    esp_deep_sleep_enable_gpio_wakeup(
        BIT(GPIO_NUM_3),
        ESP_GPIO_WAKEUP_GPIO_LOW
    );

    delay(100); // Let serial flush
    esp_deep_sleep_start();
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n\n=== LipSync Firmware ===");

    esp_sleep_wakeup_cause_t wakeReason = esp_sleep_get_wakeup_cause();
    if (wakeReason == ESP_SLEEP_WAKEUP_GPIO) {
        Serial.println("Woke from deep sleep via button");
    } else {
        Serial.println("Normal boot");
    }

    // Status LEDs
    pinMode(LED_PIN, OUTPUT);   // LED1: Green - Connection status
    pinMode(LED2_PIN, OUTPUT);  // LED2: Red - Session status

    // Blink LEDs on boot to verify wiring
    Serial.println("LED test...");
    for (int i = 0; i < 3; i++) {
        digitalWrite(LED_PIN, HIGH);
        digitalWrite(LED2_PIN, HIGH);
        delay(150);
        digitalWrite(LED_PIN, LOW);
        digitalWrite(LED2_PIN, LOW);
        delay(150);
    }

    // Reset button (active-low with internal pull-up)
    pinMode(BUTTON_PIN, INPUT_PULLUP);

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

    // Start Access Point
    WiFi.mode(WIFI_AP);
    const char* apSSID = "LipSync";
    const char* apPassword = "lipsync123";  // Min 8 characters
    WiFi.softAP(apSSID, apPassword);
    Serial.printf("Access Point started: %s (password: %s)\n", apSSID, apPassword);
    Serial.printf("AP IP Address: %s\n", WiFi.softAPIP().toString().c_str());

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
    server.on("/assets/audio/kiss-lick.mp3", HTTP_GET, [](AsyncWebServerRequest* request) {
        Serial.println("Request for /assets/audio/kiss-lick.mp3");
        if (LittleFS.exists("/assets/audio/kiss-lick.mp3")) {
            Serial.println("  File exists!");
            request->send(LittleFS, "/assets/audio/kiss-lick.mp3", "audio/mpeg");
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
                  WiFi.softAPIP().toString().c_str());
    lastActivityTime = millis();
}

void loop() {
    unsigned long now = millis();
    // Check reset button (hold for 1 second to reset)
    if (digitalRead(BUTTON_PIN) == LOW) {
        lastActivityTime = now;
        if (buttonPressStart == 0) {
            buttonPressStart = millis();
            Serial.println("Button pressed - hold 1s to reset");
        } else if (millis() - buttonPressStart >= BUTTON_HOLD_TIME) {
            Serial.println("Resetting...");
            delay(100);
            ESP.restart();
        }
    } else {
        buttonPressStart = 0;
    }

    // LED1: Blink - fast when client connected, slow when waiting
    unsigned long blinkRate = connectedClient ? 200 : 1000;
    if (millis() - lastBlink >= blinkRate) {
        lastBlink = millis();
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    }

    // LED2: Solid when session active
    digitalWrite(LED2_PIN, session.active ? HIGH : LOW);

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
        } else if (cmd == "r" || cmd == "reset") {
            Serial.println("Resetting...");
            delay(100);
            ESP.restart();
        } else if (cmd == "h" || cmd == "help") {
            Serial.println("Commands: v=vibrate, b=beep, s=status, r=reset, h=help");
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
            lastActivityTime = now;
            CycleEvent cycle = motion.getCycle();
            lastCycleTime = millis();

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

        #ifdef ENABLE_PITCH_STREAMING
        // Broadcast pitch at throttled rate for visualization (25Hz)
        if (connectedClient && millis() - lastPitchBroadcast >= 40) {
            lastPitchBroadcast = millis();
            JsonDocument doc;
            doc["type"] = "pitch";
            doc["data"]["pitch"] = motion.getPitch();
            String json;
            serializeJson(doc, json);
            sendToClient(json);
        }
        #endif

        // Check for stall (no motion for too long) - only in normal mode
        if (session.active && session.sessionMode == MODE_NORMAL && session.graceCycles == 0 && lastCycleTime > 0) {
            unsigned long expectedCycleTime = 60000 / session.targetBPM;
            unsigned long stallTimeout = expectedCycleTime * STALL_CYCLE_COUNT;
            unsigned long timeSinceLastCycle = millis() - lastCycleTime;

            if (timeSinceLastCycle > stallTimeout && session.punishmentMode != PUNISHMENT_OFF) {
                Serial.printf("STALL detected: no motion for %lums (timeout: %lums)\n",
                              timeSinceLastCycle, stallTimeout);

                // Calculate feedback intensity
                int feedbackIntensity;
                if (session.increasingIntensity) {
                    feedbackIntensity = session.currentIntensity;
                } else {
                    feedbackIntensity = session.maxIntensity;
                }

                const char* punishmentType = "none";
                bool isWarning = false;

                if (rfAvailable) {
                    switch (session.punishmentMode) {
                        case PUNISHMENT_BEEP:
                            rf.beep(session.transmitterId, session.channel);
                            punishmentType = "beep";
                            break;
                        case PUNISHMENT_VIBRATE:
                            rf.vibrate(session.transmitterId, session.channel, feedbackIntensity);
                            punishmentType = "vibrate";
                            break;
                        case PUNISHMENT_SHOCK:
                            // One warning per speed, then shock
                            if (!session.shockWarningGiven) {
                                rf.vibrate(session.transmitterId, session.channel, feedbackIntensity);
                                punishmentType = "vibrate";
                                isWarning = true;
                                session.shockWarningGiven = true;
                                // Grace period after warning to correct
                                session.graceCycles = GRACE_PERIOD_CYCLES;
                            } else {
                                rf.shock(session.transmitterId, session.channel, feedbackIntensity);
                                punishmentType = "shock";
                                // Grace period after shock to recover
                                session.graceCycles = GRACE_PERIOD_CYCLES;
                            }
                            break;
                        default:
                            break;
                    }
                }

                // Increase intensity for next time (if enabled), but not for warnings
                if (session.increasingIntensity && !isWarning) {
                    session.currentIntensity = min(session.currentIntensity + INTENSITY_INCREMENT, session.maxIntensity);
                    Serial.printf("Next intensity: %d%% (max: %d%%)\n", session.currentIntensity, session.maxIntensity);
                }

                // Reset timer to avoid continuous feedback
                lastCycleTime = millis();

                // Notify client
                if (connectedClient) {
                    JsonDocument doc;
                    doc["type"] = "punishment";
                    doc["data"]["punishmentType"] = punishmentType;
                    doc["data"]["intensity"] = feedbackIntensity;
                    doc["data"]["isWarning"] = isWarning;
                    doc["data"]["reason"] = "stall";
                    String json;
                    serializeJson(doc, json);
                    sendToClient(json);
                }
            }
        }
    }
    if (!session.active &&
        !connectedClient &&
        (now - lastActivityTime > IDLE_SLEEP_TIMEOUT)) {

        Serial.println("Idle timeout reached");
        delay(200);
        enterDeepSleep();
    }
}

void onWsEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT:
            lastActivityTime = millis();
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
            lastActivityTime = millis();
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
            session.graceCycles = GRACE_PERIOD_CYCLES;
            session.currentIntensity = INTENSITY_START;  // Reset intensity
            session.shockWarningGiven = false;
            lastCycleTime = millis();  // Reset stall timer
            Serial.printf("Session STARTED - grace period: %d cycles\n", GRACE_PERIOD_CYCLES);

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
            bool bpmChanged = false;
            if (doc["data"]["paceBPM"].is<int>()) {
                int newBPM = doc["data"]["paceBPM"];
                if (newBPM != session.targetBPM) {
                    session.targetBPM = newBPM;
                    bpmChanged = true;
                }
            }
            if (doc["data"]["depthDegrees"].is<int>())
                session.targetDepth = doc["data"]["depthDegrees"];
            if (doc["data"]["tolerance"].is<float>())
                session.tolerance = doc["data"]["tolerance"];

            // Give user grace period to adjust to new BPM
            if (bpmChanged) {
                session.graceCycles = GRACE_PERIOD_CYCLES;
                session.shockWarningGiven = false;  // Reset warning for new speed
                Serial.printf("BPM changed - grace period: %d cycles\n", GRACE_PERIOD_CYCLES);
            }

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

        } else if (strcmp(type, "setMaxIntensity") == 0) {
            if (doc["data"]["maxIntensity"].is<int>())
                session.maxIntensity = doc["data"]["maxIntensity"];

            Serial.printf("Max Intensity: %d\n", session.maxIntensity);

        } else if (strcmp(type, "setIncreasingIntensity") == 0) {
            if (doc["data"]["enabled"].is<bool>())
                session.increasingIntensity = doc["data"]["enabled"];

            Serial.printf("Increasing Intensity: %s\n", session.increasingIntensity ? "ON" : "OFF");

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

        } else if (strcmp(type, "testShock") == 0) {
            int intensity = doc["data"]["intensity"] | 30;
            Serial.printf("Test shock: %d%%\n", intensity);
            if (rfAvailable) {
                rf.shock(session.transmitterId, session.channel, intensity);
            } else {
                Serial.println("(RF not available)");
            }

        } else if (strcmp(type, "setPunishmentMode") == 0) {
            const char* mode = doc["data"]["mode"];
            if (strcmp(mode, "off") == 0) {
                session.punishmentMode = PUNISHMENT_OFF;
            } else if (strcmp(mode, "beep") == 0) {
                session.punishmentMode = PUNISHMENT_BEEP;
            } else if (strcmp(mode, "vibrate") == 0) {
                session.punishmentMode = PUNISHMENT_VIBRATE;
            } else if (strcmp(mode, "shock") == 0) {
                session.punishmentMode = PUNISHMENT_SHOCK;
            }
            Serial.printf("Punishment mode: %s\n", mode);

        } else if (strcmp(type, "setMode") == 0) {
            const char* mode = doc["data"]["mode"];
            if (strcmp(mode, "normal") == 0) {
                session.sessionMode = MODE_NORMAL;
            } else if (strcmp(mode, "kissLick") == 0) {
                session.sessionMode = MODE_KISS_LICK;
            } else if (strcmp(mode, "deepthroat") == 0) {
                session.sessionMode = MODE_DEEPTHROAT;
            }
            Serial.printf("Session mode: %s (feedback %s)\n", mode,
                          session.sessionMode == MODE_NORMAL ? "enabled" : "disabled");

        } else if (strcmp(type, "getState") == 0) {
            broadcastState();
        }
    }
}

void evaluateAndFeedback(const CycleEvent& cycle) {
    // Skip feedback in hold modes (kissLick, deepthroat)
    if (session.sessionMode != MODE_NORMAL) {
        return;
    }

    // Calculate expected duration from target BPM
    float expectedDuration = 60000.0f / session.targetBPM;

    // Calculate deviations (0 = perfect, 1 = 100% off)
    float paceDeviation = abs(cycle.duration - expectedDuration) / expectedDuration;
    float depthDeviation = abs(cycle.depth - session.targetDepth) / (float)session.targetDepth;

    // Combined deviation (weighted - pace is primary)
    float deviation = (paceDeviation * 0.9f) + (depthDeviation * 0.1f);
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

    // Check grace period
    if (session.graceCycles > 0) {
        session.graceCycles--;
        Serial.printf("Grace period: %d cycles remaining\n", session.graceCycles);
        return;
    }

    // Trigger feedback if deviation exceeds tolerance
    if (deviation > session.tolerance && session.punishmentMode != PUNISHMENT_OFF) {
        // Calculate feedback intensity
        int feedbackIntensity;
        if (session.increasingIntensity) {
            // Use current level (starts low, increases each time)
            feedbackIntensity = session.currentIntensity;
        } else {
            // Use max intensity directly
            feedbackIntensity = session.maxIntensity;
        }

        const char* punishmentType = "none";
        bool isWarning = false;

        if (rfAvailable) {
            switch (session.punishmentMode) {
                case PUNISHMENT_BEEP:
                    Serial.println("FEEDBACK: beep");
                    rf.beep(session.transmitterId, session.channel);
                    punishmentType = "beep";
                    break;
                case PUNISHMENT_VIBRATE:
                    Serial.printf("FEEDBACK: %d%% vibrate\n", feedbackIntensity);
                    rf.vibrate(session.transmitterId, session.channel, feedbackIntensity);
                    punishmentType = "vibrate";
                    break;
                case PUNISHMENT_SHOCK:
                    // One warning per speed, then shock
                    if (!session.shockWarningGiven) {
                        Serial.printf("FEEDBACK: WARNING vibrate %d%%\n", feedbackIntensity);
                        rf.vibrate(session.transmitterId, session.channel, feedbackIntensity);
                        punishmentType = "vibrate";
                        isWarning = true;
                        session.shockWarningGiven = true;
                        // Grace period after warning to correct
                        session.graceCycles = GRACE_PERIOD_CYCLES;
                        Serial.printf("Grace period after warning: %d cycles\n", GRACE_PERIOD_CYCLES);
                    } else {
                        Serial.printf("FEEDBACK: %d%% SHOCK\n", feedbackIntensity);
                        rf.shock(session.transmitterId, session.channel, feedbackIntensity);
                        punishmentType = "shock";
                        // Grace period after shock to recover
                        session.graceCycles = GRACE_PERIOD_CYCLES;
                        Serial.printf("Grace period after shock: %d cycles\n", GRACE_PERIOD_CYCLES);
                    }
                    break;
                default:
                    break;
            }
        }

        // Increase intensity for next time (if enabled), but not for warnings
        if (session.increasingIntensity && !isWarning) {
            session.currentIntensity = min(session.currentIntensity + INTENSITY_INCREMENT, session.maxIntensity);
            Serial.printf("Next intensity: %d%% (max: %d%%)\n", session.currentIntensity, session.maxIntensity);
        }

        // Notify client of punishment
        if (connectedClient) {
            JsonDocument doc;
            doc["type"] = "punishment";
            doc["data"]["punishmentType"] = punishmentType;
            doc["data"]["intensity"] = feedbackIntensity;
            doc["data"]["isWarning"] = isWarning;
            doc["data"]["deviation"] = deviation;
            String json;
            serializeJson(doc, json);
            sendToClient(json);
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
