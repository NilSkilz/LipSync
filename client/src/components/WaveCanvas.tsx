import { useRef, useEffect, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { useAudio } from '../hooks/useAudio';
import { useWakeLock } from '../hooks/useWakeLock';

interface AnimationState {
  phase: number;
  waveHistory: number[];
  displayAmplitude: number;
  lastState: 'in' | 'out' | null;
}

export function WaveCanvas() {
  const { state } = useSession();
  const { active, cycleSpeed, holdPosition, soundEnabled, pitchHistory } = state;

  // Keep screen awake when session is active
  useWakeLock(active);

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

  // Draw wave with fixed transition curves and variable plateaus
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

    // Fixed transition duration (in phase units, e.g., 0.15 = 15% of cycle for each transition)
    const transitionDuration = 0.15;

    // Convert phase to Y position with plateau wave shape
    // Phase 0-0.15: transition up (out to in)
    // Phase 0.15-0.5: plateau at top (in)
    // Phase 0.5-0.65: transition down (in to out)
    // Phase 0.65-1.0: plateau at bottom (out)
    const getY = (p: number) => {
      const normalizedPhase = ((p % 1) + 1) % 1; // Ensure 0-1 range

      let value: number;
      if (normalizedPhase < transitionDuration) {
        // Transition up: smooth curve from -1 to 1
        const t = normalizedPhase / transitionDuration;
        value = -1 + 2 * (0.5 - 0.5 * Math.cos(t * Math.PI));
      } else if (normalizedPhase < 0.5) {
        // Plateau at top
        value = 1;
      } else if (normalizedPhase < 0.5 + transitionDuration) {
        // Transition down: smooth curve from 1 to -1
        const t = (normalizedPhase - 0.5) / transitionDuration;
        value = 1 - 2 * (0.5 - 0.5 * Math.cos(t * Math.PI));
      } else {
        // Plateau at bottom
        value = -1;
      }

      return centerY - value * amplitude;
    };

    // Draw current position indicator
    const indicatorX = width - 40;
    const currentY = getY(phase);

    // Draw the wave from history, ending at the dot position
    ctx.beginPath();
    ctx.moveTo(0, getY(waveHistory[0]));

    for (let i = 1; i < historyLen; i++) {
      const x = (i / historyLen) * indicatorX;
      const y = getY(waveHistory[i]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = waveColor;
    ctx.arc(indicatorX, currentY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw user's actual motion from pitch history (cyan)
    if (pitchHistory.length > 1) {
      // Auto-scale based on observed pitch range
      const minPitch = Math.min(...pitchHistory);
      const maxPitch = Math.max(...pitchHistory);
      const pitchRange = Math.max(maxPitch - minPitch, 10); // At least 10 degrees range
      const pitchCenter = (maxPitch + minPitch) / 2;

      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();

      const pitchLen = pitchHistory.length;
      for (let i = 0; i < pitchLen; i++) {
        // Map pitch to Y: center pitch = centerY, +range/2 = top, -range/2 = bottom
        const normalizedPitch = (pitchHistory[i] - pitchCenter) / (pitchRange / 2);
        const y = centerY - normalizedPitch * amplitude;
        const x = (i / pitchLen) * indicatorX;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw current pitch indicator
      const currentPitchNorm = (pitchHistory[pitchLen - 1] - pitchCenter) / (pitchRange / 2);
      const currentPitchY = centerY - currentPitchNorm * amplitude;
      ctx.beginPath();
      ctx.fillStyle = '#00d4ff';
      ctx.arc(indicatorX, currentPitchY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

  }, [active, pitchHistory]);

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

      // Check for state change (for beeps) - beep at START of transition
      const normalizedPhase = ((anim.phase % 1) + 1) % 1;

      // Detect which half of the cycle we're in
      let newState: 'in' | 'out' | null = null;
      if (normalizedPhase < 0.5) {
        newState = 'in'; // First half: transitioning/holding at top
      } else {
        newState = 'out'; // Second half: transitioning/holding at bottom
      }

      // Beep when crossing 0 (start up) or 0.5 (start down)
      if (newState && newState !== anim.lastState && active) {
        if (newState === 'in') {
          playBeep(880); // High beep: start moving up
        } else {
          playBeep(440); // Low beep: start moving down
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
    </div>
  );
}
