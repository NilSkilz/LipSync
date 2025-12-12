export interface TargetParams {
  paceBPM: number;        // target cycles per minute
  depthDegrees: number;   // target angle range per cycle
  tolerance: number;      // 0-1, how much deviation before feedback
}

export interface SessionState {
  active: boolean;
  targets: TargetParams;
  feedbackIntensity: number; // 0-100
  shockerId: string;
}

// Sent by ESP32 sensor on each completed stroke
export interface CycleEvent {
  duration: number;   // ms for this cycle (time since last reversal)
  depth: number;      // degrees of motion in this cycle
  timestamp: number;  // ms since epoch
}

// Result of evaluating a cycle
export interface CycleResult {
  currentBPM: number;       // calculated from cycle duration
  currentDepth: number;     // degrees
  paceDeviation: number;    // 0-1
  depthDeviation: number;   // 0-1
  deviation: number;        // 0-1, combined
  feedback: boolean;        // whether feedback was triggered
}

// Messages from phone
export type PhoneMessage =
  | { type: 'setTargets'; data: Partial<TargetParams> }
  | { type: 'setIntensity'; data: { intensity: number } }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'testVibrate'; data?: { intensity: number } }
  | { type: 'testBeep' };

// Messages from sensor
export type SensorMessage =
  | { type: 'cycle'; data: CycleEvent };

// Messages to phone
export type ServerToPhoneMessage =
  | { type: 'state'; data: SessionState }
  | { type: 'targetsUpdated'; data: TargetParams }
  | { type: 'sessionStarted' }
  | { type: 'sessionStopped' }
  | { type: 'cycleResult'; data: { cycle: CycleEvent; result: CycleResult } };

// Messages to sensor
export type ServerToSensorMessage =
  | { type: 'sessionStatus'; data: { active: boolean } };