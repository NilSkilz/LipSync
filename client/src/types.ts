export interface TargetParams {
  paceBPM: number;
  depthDegrees: number;
  tolerance: number;
}

export interface SessionState {
  active: boolean;
  targets: TargetParams;
  feedbackIntensity: number;
  shockerId: string;
}

export interface CycleEvent {
  duration: number;
  depth: number;
  timestamp: number;
}

export interface CycleResult {
  currentBPM: number;
  currentDepth: number;
  paceDeviation: number;
  depthDeviation: number;
  deviation: number;
  feedback: boolean;
}

// Messages from client to server
export type ClientMessage =
  | { type: 'setTargets'; data: Partial<TargetParams> }
  | { type: 'setIntensity'; data: { intensity: number } }
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'testVibrate'; data?: { intensity: number } }
  | { type: 'testBeep' }
  | { type: 'setMode'; data: { mode: string; duration?: number } };

// Messages from server to client
export type ServerMessage =
  | { type: 'state'; data: SessionState }
  | { type: 'targetsUpdated'; data: TargetParams }
  | { type: 'sessionStarted' }
  | { type: 'sessionStopped' }
  | { type: 'cycleResult'; data: { cycle: CycleEvent; result: CycleResult } }
  | { type: 'pitch'; data: { pitch: number; roll: number } }
  | { type: 'punishment'; data: { punishmentType: string; intensity: number; isWarning: boolean; reason?: string } };

// App state
export type AppMode = 'normal' | 'kissLick' | 'deepthroat';
export type PunishmentMode = 'off' | 'beep' | 'vibrate' | 'shock';

export interface PunishmentFlash {
  type: string;
  isWarning: boolean;
  timestamp: number;
}

export interface AppState {
  isConnected: boolean;
  active: boolean;
  speedPercent: number;
  cycleSpeed: number;
  mode: AppMode;
  holdPosition: 'in' | 'out' | null;
  timerSeconds: number;
  soundEnabled: boolean;
  feedbackIntensity: number;
  maxIntensity: number;
  increasingIntensity: boolean;
  currentIntensity: number;
  lastCycleResult: CycleResult | null;
  punishmentMode: PunishmentMode;
  settingsOpen: boolean;
  pitchHistory: number[];
  currentPitch: number;
  punishmentFlash: PunishmentFlash | null;
}

export type AppAction =
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_ACTIVE'; payload: boolean }
  | { type: 'SET_SPEED'; payload: number }
  | { type: 'SET_MODE'; payload: { mode: AppMode; holdPosition: 'in' | 'out' | null } }
  | { type: 'CLEAR_MODE' }
  | { type: 'SET_TIMER'; payload: number }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'SET_CYCLE_RESULT'; payload: CycleResult }
  | { type: 'SYNC_STATE'; payload: Partial<SessionState> }
  | { type: 'SET_PUNISHMENT_MODE'; payload: PunishmentMode }
  | { type: 'SET_INTENSITY'; payload: number }
  | { type: 'SET_MAX_INTENSITY'; payload: number }
  | { type: 'SET_INCREASING_INTENSITY'; payload: boolean }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'UPDATE_PITCH'; payload: number }
  | { type: 'PUNISHMENT_FLASH'; payload: PunishmentFlash }
  | { type: 'CLEAR_PUNISHMENT_FLASH' }
  | { type: 'SET_CURRENT_INTENSITY'; payload: number }
  | { type: 'RESET_CURRENT_INTENSITY' };
