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

export interface MotionSample {
  timestamp: number;   // ms since epoch
  pitch: number;       // degrees, head angle forward/back
  roll: number;        // degrees, head tilt left/right
  yaw: number;         // degrees, head rotation
  accelX: number;      // m/s², forward/back acceleration
  accelY: number;      // m/s², left/right acceleration  
  accelZ: number;      // m/s², up/down acceleration
}

export interface MotionResult {
  currentPace: number;      // detected BPM
  currentDepth: number;     // detected angle range
  paceDeviation: number;    // 0-1, how far from target
  depthDeviation: number;   // 0-1, how far from target
  deviation: number;        // 0-1, combined score
}

// Messages from phone
export type PhoneMessage =
  | { type: 'setTargets'; data: Partial<TargetParams> }
  | { type: 'setIntensity'; data: { intensity: number } }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'testVibrate'; data?: { intensity: number } };

// Messages from sensor
export type SensorMessage = 
  | { type: 'motion'; data: MotionSample };

// Messages to clients
export type ServerMessage =
  | { type: 'state'; data: SessionState }
  | { type: 'targetsUpdated'; data: TargetParams }
  | { type: 'sessionStarted' }
  | { type: 'sessionStopped' }
  | { type: 'motionUpdate'; data: { sample: MotionSample; result: MotionResult } };
