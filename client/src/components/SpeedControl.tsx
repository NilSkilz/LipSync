import { useRef, useCallback, useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { useAudio } from '../hooks/useAudio';

export function SpeedControl() {
  const { state, actions } = useSession();
  const { speedPercent, active, soundEnabled } = state;
  const { initAudio } = useAudio(soundEnabled);

  const trackRef = useRef<HTMLDivElement>(null);
  const [localPercent, setLocalPercent] = useState(speedPercent);
  const isDragging = useRef(false);

  // Sync local state with app state when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      setLocalPercent(speedPercent);
    }
  }, [speedPercent]);

  const calculatePercent = useCallback((clientY: number): number => {
    const track = trackRef.current;
    if (!track) return localPercent;

    const rect = track.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    return Math.round(Math.max(0, Math.min(100, 100 - (relativeY / rect.height) * 100)));
  }, [localPercent]);

  const commitSpeed = useCallback((percent: number) => {
    actions.setSpeed(percent);

    if (percent === 0 && active) {
      actions.stop();
    } else if (percent > 0 && !active) {
      actions.start();
    }
  }, [actions, active]);

  const handleStart = useCallback((clientY: number) => {
    initAudio();
    isDragging.current = true;
    const percent = calculatePercent(clientY);
    setLocalPercent(percent);
    commitSpeed(percent);
  }, [initAudio, calculatePercent, commitSpeed]);

  const handleMove = useCallback((clientY: number) => {
    if (!isDragging.current) return;
    const percent = calculatePercent(clientY);
    setLocalPercent(percent);
    commitSpeed(percent);
  }, [calculatePercent, commitSpeed]);

  const handleEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientY);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY);
  }, [handleMove]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleEnd();
  }, [handleEnd]);

  // Mouse events
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY);

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY);
    };

    const onMouseUp = () => {
      handleEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [handleStart, handleMove, handleEnd]);

  // Calculate button position (0% = bottom, 100% = top)
  const buttonTop = `${100 - localPercent}%`;

  return (
    <div className="speed-control">
      <div
        className="speed-track"
        ref={trackRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        <div className="speed-track-fill" style={{ height: `${localPercent}%` }} />
        <div className="speed-button" style={{ top: buttonTop }}>
          <div className="speed-button-inner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
        </div>
      </div>
      <div className="speed-label">
        <span className="speed-title">Speed</span>
        <span className="speed-value">{localPercent}%</span>
      </div>
    </div>
  );
}
