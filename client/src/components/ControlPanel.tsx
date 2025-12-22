import { useRef, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { useAudio } from '../hooks/useAudio';
import { ActionButton } from './ActionButton';
import { TimerControl } from './TimerControl';
import { IntensityMeter } from './IntensityMeter';

export function ControlPanel() {
  const { state, actions } = useSession();
  const { active, mode, soundEnabled, timerSeconds, currentIntensity, maxIntensity, increasingIntensity } = state;
  const deepthroatTimeoutRef = useRef<number | null>(null);

  const { initAudio, startHum, stopHum, playKissLickLoop, stopKissLickLoop } = useAudio(soundEnabled);

  const handleStartPause = useCallback(() => {
    initAudio();
    if (active) {
      actions.stop();
      actions.setSpeed(0);
      actions.clearMode();
      stopKissLickLoop();
      stopHum();
    } else {
      if (state.speedPercent === 0) {
        actions.setSpeed(50);
      }
      actions.start();
    }
  }, [active, state.speedPercent, actions, initAudio, stopKissLickLoop, stopHum]);

  const handleKissLick = useCallback(() => {
    initAudio();

    if (mode === 'kissLick') {
      actions.clearMode();
      stopKissLickLoop();
    } else {
      actions.setMode('kissLick', 'out');
      playKissLickLoop();

      if (!active) {
        actions.start();
      }
    }
  }, [mode, active, actions, initAudio, playKissLickLoop, stopKissLickLoop]);

  const handleDeepthroat = useCallback(() => {
    initAudio();

    if (deepthroatTimeoutRef.current) {
      clearTimeout(deepthroatTimeoutRef.current);
    }

    if (mode === 'kissLick') {
      stopKissLickLoop();
    }

    actions.setMode('deepthroat', 'in');
    startHum();

    if (!active) {
      actions.start();
    }

    deepthroatTimeoutRef.current = window.setTimeout(() => {
      actions.clearMode();
      stopHum();
    }, timerSeconds * 1000);
  }, [mode, active, timerSeconds, actions, initAudio, startHum, stopHum, stopKissLickLoop]);

  const handleToggleSound = useCallback(() => {
    initAudio();
    actions.toggleSound();
  }, [actions, initAudio]);

  const handleOpenSettings = useCallback(() => {
    actions.toggleSettings();
  }, [actions]);

  return (
    <div className="control-panel">
      <div className="icon-row">
        <ActionButton
          variant="icon"
          onClick={handleToggleSound}
          active={soundEnabled}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
          </svg>
        </ActionButton>
        <ActionButton variant="icon" onClick={handleOpenSettings}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </ActionButton>
      </div>

      {increasingIntensity && (
        <IntensityMeter current={currentIntensity} max={maxIntensity} />
      )}

      <div className="hold-modes-row">
        <button className={`hold-mode-btn ${mode === 'deepthroat' ? 'active' : ''}`} onClick={handleDeepthroat}>
          {mode === 'deepthroat' ? '■ Stop' : '● Hold'}
        </button>
        <button className={`hold-mode-btn ${mode === 'kissLick' ? 'active' : ''}`} onClick={handleKissLick}>
          {mode === 'kissLick' ? '■ Stop' : '♥ Kiss'}
        </button>
      </div>

      <TimerControl />

      <ActionButton variant="outline" onClick={handleStartPause} active={active}>
        {active ? 'Pause' : 'Start'}
      </ActionButton>
    </div>
  );
}
