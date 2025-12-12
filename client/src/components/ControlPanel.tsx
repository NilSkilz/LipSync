import { useRef, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { useAudio } from '../hooks/useAudio';
import { ActionButton } from './ActionButton';
import { TimerControl } from './TimerControl';

export function ControlPanel() {
  const { state, actions } = useSession();
  const { active, mode, soundEnabled, timerSeconds } = state;
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

  const handleTestVibrate = useCallback(() => {
    actions.testVibrate(20);
  }, [actions]);

  const handleToggleSound = useCallback(() => {
    initAudio();
    actions.toggleSound();
  }, [actions, initAudio]);

  return (
    <div className="control-panel">
      <div className="icon-row">
        <ActionButton variant="icon" onClick={handleTestVibrate}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12c2-4 4-6 6-6s4 4 6 4 4-4 6-4c2 0 4 2 6 6" />
          </svg>
        </ActionButton>
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
      </div>

      <ActionButton onClick={handleKissLick} active={mode === 'kissLick'}>
        {mode === 'kissLick' ? 'Stop Kiss & Lick' : 'Kiss & Lick'}
      </ActionButton>

      <TimerControl />

      <ActionButton onClick={handleDeepthroat}>
        Deepthroat
      </ActionButton>

      <ActionButton variant="outline" onClick={handleStartPause} active={active}>
        {active ? 'Pause' : 'Start'}
      </ActionButton>
    </div>
  );
}
