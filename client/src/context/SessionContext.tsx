import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useConnection } from './ConnectionContext';
import type { AppState, AppAction, ServerMessage, AppMode, PunishmentMode } from '../types';

const initialState: AppState = {
  isConnected: false,
  active: false,
  speedPercent: 50,
  cycleSpeed: 2,
  mode: 'normal',
  holdPosition: null,
  timerSeconds: 4,
  soundEnabled: true,
  feedbackIntensity: 50,
  maxIntensity: 50,
  increasingIntensity: true,
  currentIntensity: 10,
  lastCycleResult: null,
  punishmentMode: 'vibrate',
  settingsOpen: false,
  pitchHistory: [],
  currentPitch: 0,
  punishmentFlash: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_ACTIVE':
      return { ...state, active: action.payload };
    case 'SET_SPEED': {
      const speedPercent = action.payload;
      // Map 1-100% to 3s-1s cycle time
      const cycleSpeed = speedPercent === 0 ? 2 : 3 - ((speedPercent - 1) / 99) * 2;
      return { ...state, speedPercent, cycleSpeed };
    }
    case 'SET_MODE':
      return { ...state, mode: action.payload.mode, holdPosition: action.payload.holdPosition };
    case 'CLEAR_MODE':
      return { ...state, mode: 'normal', holdPosition: null };
    case 'SET_TIMER':
      return { ...state, timerSeconds: action.payload };
    case 'TOGGLE_SOUND':
      return { ...state, soundEnabled: !state.soundEnabled };
    case 'SET_CYCLE_RESULT':
      return { ...state, lastCycleResult: action.payload };
    case 'SYNC_STATE':
      return {
        ...state,
        active: action.payload.active ?? state.active,
        feedbackIntensity: action.payload.feedbackIntensity ?? state.feedbackIntensity,
      };
    case 'SET_PUNISHMENT_MODE':
      return { ...state, punishmentMode: action.payload };
    case 'SET_INTENSITY':
      return { ...state, feedbackIntensity: action.payload };
    case 'SET_MAX_INTENSITY':
      return { ...state, maxIntensity: action.payload };
    case 'SET_INCREASING_INTENSITY':
      return { ...state, increasingIntensity: action.payload };
    case 'TOGGLE_SETTINGS':
      return { ...state, settingsOpen: !state.settingsOpen };
    case 'UPDATE_PITCH': {
      const newHistory = [...state.pitchHistory, action.payload];
      // Keep ~3.2 seconds of history (80 samples at 25Hz)
      if (newHistory.length > 80) newHistory.shift();
      return { ...state, pitchHistory: newHistory, currentPitch: action.payload };
    }
    case 'PUNISHMENT_FLASH':
      return { ...state, punishmentFlash: action.payload };
    case 'CLEAR_PUNISHMENT_FLASH':
      return { ...state, punishmentFlash: null };
    case 'SET_CURRENT_INTENSITY':
      return { ...state, currentIntensity: action.payload };
    case 'RESET_CURRENT_INTENSITY':
      return { ...state, currentIntensity: 10 };
    default:
      return state;
  }
}

interface SessionContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  send: (type: string, data?: Record<string, unknown>) => void;
  actions: {
    start: () => void;
    stop: () => void;
    setSpeed: (percent: number) => void;
    setMode: (mode: AppMode, holdPosition: 'in' | 'out' | null) => void;
    clearMode: () => void;
    setTimer: (seconds: number) => void;
    toggleSound: () => void;
    toggleSettings: () => void;
    testVibrate: (intensity?: number) => void;
    testBeep: () => void;
    testShock: (intensity?: number) => void;
    setPunishmentMode: (mode: PunishmentMode) => void;
    setIntensity: (intensity: number) => void;
    setMaxIntensity: (intensity: number) => void;
    setIncreasingIntensity: (enabled: boolean) => void;
  };
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const lastSentBPMRef = useRef<number | null>(null);
  const { deviceUrl } = useConnection();

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'state':
        dispatch({ type: 'SYNC_STATE', payload: msg.data });
        break;
      case 'sessionStarted':
        dispatch({ type: 'SET_ACTIVE', payload: true });
        dispatch({ type: 'RESET_CURRENT_INTENSITY' });
        break;
      case 'sessionStopped':
        dispatch({ type: 'SET_ACTIVE', payload: false });
        break;
      case 'cycleResult':
        dispatch({ type: 'SET_CYCLE_RESULT', payload: msg.data.result });
        break;
      case 'pitch':
        dispatch({ type: 'UPDATE_PITCH', payload: msg.data.pitch });
        break;
      case 'punishment':
        dispatch({
          type: 'PUNISHMENT_FLASH',
          payload: {
            type: msg.data.punishmentType,
            isWarning: msg.data.isWarning,
            timestamp: Date.now(),
          },
        });
        // Update current intensity display
        if (msg.data.intensity) {
          dispatch({ type: 'SET_CURRENT_INTENSITY', payload: msg.data.intensity });
        }
        // Clear flash after 1.5s
        setTimeout(() => {
          dispatch({ type: 'CLEAR_PUNISHMENT_FLASH' });
        }, 1500);
        break;
    }
  }, []);

  const handleConnect = useCallback(() => {
    dispatch({ type: 'SET_CONNECTED', payload: true });
  }, []);

  const handleDisconnect = useCallback(() => {
    dispatch({ type: 'SET_CONNECTED', payload: false });
  }, []);

  const { send } = useWebSocket({
    url: deviceUrl,
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
  });

  const actions = {
    start: useCallback(() => {
      dispatch({ type: 'SET_ACTIVE', payload: true });
      // Send current targets before starting so device has correct BPM
      const cycleSpeed = state.speedPercent === 0 ? 2 : 3 - ((state.speedPercent - 1) / 99) * 2;
      const paceBPM = Math.round(60 / cycleSpeed);
      send('setTargets', { paceBPM });
      send('start');
    }, [send, state.speedPercent]),

    stop: useCallback(() => {
      dispatch({ type: 'SET_ACTIVE', payload: false });
      send('stop');
    }, [send]),

    setSpeed: useCallback((percent: number) => {
      dispatch({ type: 'SET_SPEED', payload: percent });
      if (percent > 0) {
        const cycleSpeed = 3 - ((percent - 1) / 99) * 2;
        const paceBPM = Math.round(60 / cycleSpeed);
        // Only send if BPM has changed
        if (paceBPM !== lastSentBPMRef.current) {
          lastSentBPMRef.current = paceBPM;
          send('setTargets', { paceBPM });
        }
      }
    }, [send]),

    setMode: useCallback((mode: AppMode, holdPosition: 'in' | 'out' | null) => {
      dispatch({ type: 'SET_MODE', payload: { mode, holdPosition } });
      send('setMode', { mode });
    }, [send]),

    clearMode: useCallback(() => {
      dispatch({ type: 'CLEAR_MODE' });
      send('setMode', { mode: 'normal' });
    }, [send]),

    setTimer: useCallback((seconds: number) => {
      dispatch({ type: 'SET_TIMER', payload: seconds });
    }, []),

    toggleSound: useCallback(() => {
      dispatch({ type: 'TOGGLE_SOUND' });
    }, []),

    testVibrate: useCallback((intensity = 20) => {
      send('testVibrate', { intensity });
    }, [send]),

    testBeep: useCallback(() => {
      send('testBeep');
    }, [send]),

    testShock: useCallback((intensity = 20) => {
      send('testShock', { intensity });
    }, [send]),

    toggleSettings: useCallback(() => {
      dispatch({ type: 'TOGGLE_SETTINGS' });
    }, []),

    setPunishmentMode: useCallback((mode: PunishmentMode) => {
      dispatch({ type: 'SET_PUNISHMENT_MODE', payload: mode });
      send('setPunishmentMode', { mode });
    }, [send]),

    setIntensity: useCallback((intensity: number) => {
      dispatch({ type: 'SET_INTENSITY', payload: intensity });
      send('setIntensity', { intensity });
    }, [send]),

    setMaxIntensity: useCallback((intensity: number) => {
      dispatch({ type: 'SET_MAX_INTENSITY', payload: intensity });
      send('setMaxIntensity', { maxIntensity: intensity });
    }, [send]),

    setIncreasingIntensity: useCallback((enabled: boolean) => {
      dispatch({ type: 'SET_INCREASING_INTENSITY', payload: enabled });
      send('setIncreasingIntensity', { enabled });
    }, [send]),
  };

  return (
    <SessionContext.Provider value={{ state, dispatch, send, actions }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
