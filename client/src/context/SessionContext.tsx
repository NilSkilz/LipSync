import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useConnection } from './ConnectionContext';
import type { AppState, AppAction, ServerMessage, AppMode } from '../types';

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
  lastCycleResult: null,
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
    testVibrate: (intensity?: number) => void;
    testBeep: () => void;
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
        break;
      case 'sessionStopped':
        dispatch({ type: 'SET_ACTIVE', payload: false });
        break;
      case 'cycleResult':
        dispatch({ type: 'SET_CYCLE_RESULT', payload: msg.data.result });
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
      send('start');
    }, [send]),

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
