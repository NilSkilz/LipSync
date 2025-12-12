import { useRef, useEffect, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { useAudio } from '../hooks/useAudio';

interface AnimationState {
  phase: number;
  waveHistory: number[];
  displayAmplitude: number;
  lastState: 'in' | 'out' | null;
}

export function WaveCanvas() {
  const { state } = useSession();
  const { active, cycleSpeed, holdPosition, soundEnabled } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<AnimationState>({
    phase: 0,
    waveHistory: [],
    displayAmplitude: 0,
    lastState: null,
  });
  const lastUpdateTimeRef = useRef(Date.now());

  const { playBeep, initAudio } = useAudio(soundEnabled);

  // Handle canvas resize
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Draw wave using quadratic curves for smoothness
  const drawWave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    const { phase, waveHistory, displayAmplitude } = animationRef.current;

    ctx.clearRect(0, 0, width, height);

    const padding = 20;
    const baseAmplitude = (height - padding * 2) * 0.4;
    const amplitude = baseAmplitude * displayAmplitude;

    const bottomY = height - padding;
    const middleY = height / 2;
    const centerY = bottomY - (bottomY - middleY) * displayAmplitude;

    const waveColor = active ? '#ff69b4' : '#666666';

    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const historyLen = waveHistory.length;
    if (historyLen < 2) return;

    // Convert phase values to continuous values (unwrap phase jumps)
    const unwrappedPhases: number[] = [waveHistory[0]];
    let offset = 0;
    for (let i = 1; i < historyLen; i++) {
      const prev = waveHistory[i - 1];
      const curr = waveHistory[i];
      const diff = curr - prev;

      // Detect phase wrap (jump greater than 0.5 means it wrapped)
      if (diff < -0.5) {
        offset += 1; // Wrapped from ~1 to ~0, add 1
      } else if (diff > 0.5) {
        offset -= 1; // Wrapped from ~0 to ~1 (reverse), subtract 1
      }
      unwrappedPhases.push(curr + offset);
    }

    // Draw smooth curve through points
    ctx.beginPath();

    const getY = (phaseVal: number) => centerY - Math.sin(phaseVal * Math.PI * 2) * amplitude;

    ctx.moveTo(0, getY(unwrappedPhases[0]));

    for (let i = 1; i < historyLen; i++) {
      const x = (i / historyLen) * width;
      const y = getY(unwrappedPhases[i]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw current position indicator
    const currentY = getY(phase);
    const indicatorX = width - 15;

    ctx.beginPath();
    ctx.fillStyle = waveColor;
    ctx.arc(indicatorX, currentY, 8, 0, Math.PI * 2);
    ctx.fill();
  }, [active]);

  // Update loop
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateTimeRef.current) / 1000;
      lastUpdateTimeRef.current = now;

      const anim = animationRef.current;

      // Update phase based on mode
      if (active && holdPosition === null) {
        anim.phase += deltaTime / cycleSpeed;
        if (anim.phase >= 1) anim.phase -= 1;
      } else if (holdPosition === 'in') {
        const targetPhase = 0.25;
        const diff = targetPhase - anim.phase;
        if (Math.abs(diff) < 0.01) {
          anim.phase = targetPhase;
        } else {
          anim.phase += diff * 0.15;
        }
      } else if (holdPosition === 'out') {
        const targetPhase = 0.75;
        let diff = targetPhase - anim.phase;
        if (diff > 0.5) diff -= 1;
        if (diff < -0.5) diff += 1;
        if (Math.abs(diff) < 0.01) {
          anim.phase = targetPhase;
        } else {
          anim.phase += diff * 0.15;
        }
      }

      // Update amplitude
      const targetAmplitude = active ? 1 : 0;
      anim.displayAmplitude += (targetAmplitude - anim.displayAmplitude) * 0.08;

      // Store phase in history
      anim.waveHistory.push(anim.phase);
      if (anim.waveHistory.length > 200) {
        anim.waveHistory.shift();
      }

      // Check for state change (for beeps)
      const sineValue = Math.sin(anim.phase * Math.PI * 2);
      let newState: 'in' | 'out' | null = null;

      if (sineValue > 0.95) {
        newState = 'in';
      } else if (sineValue < -0.95) {
        newState = 'out';
      }

      if (newState && newState !== anim.lastState && active) {
        if (newState === 'in') {
          playBeep(880);
        } else {
          playBeep(440);
        }
        anim.lastState = newState;
      }
    }, 16);

    return () => clearInterval(interval);
  }, [active, cycleSpeed, holdPosition, playBeep]);

  // Render loop
  useEffect(() => {
    let animationId: number;

    const render = () => {
      drawWave();
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [drawWave]);

  return (
    <div className="wave-container" onClick={initAudio}>
      <canvas ref={canvasRef} />
      <div className="position-label">
        {animationRef.current.lastState || '--'}
      </div>
    </div>
  );
}
