import { useCallback, useEffect, useRef } from 'react';

// Shared audio context across all hook instances
let sharedAudioCtx: AudioContext | null = null;
let isAudioInitialized = false;

function getAudioContext(): AudioContext | null {
  if (!sharedAudioCtx && isAudioInitialized) {
    sharedAudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return sharedAudioCtx;
}

export function useAudio(soundEnabled: boolean) {
  const humOscillatorRef = useRef<OscillatorNode | null>(null);
  const humGainRef = useRef<GainNode | null>(null);
  const kissLickAudioRef = useRef<HTMLAudioElement | null>(null);

  // Keep soundEnabled in a ref so playBeep always has current value
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const initAudio = useCallback(() => {
    if (isAudioInitialized) return;
    isAudioInitialized = true;
    sharedAudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }, []);

  const playBeep = useCallback((frequency: number, duration = 0.1) => {
    if (!soundEnabledRef.current) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    // Resume context if it's suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }, []);

  const startHum = useCallback(() => {
    if (!soundEnabledRef.current) return;
    if (humOscillatorRef.current) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 150;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);

    oscillator.start();

    humOscillatorRef.current = oscillator;
    humGainRef.current = gainNode;
  }, []);

  const stopHum = useCallback(() => {
    const humOscillator = humOscillatorRef.current;
    const humGain = humGainRef.current;
    const ctx = getAudioContext();

    if (!humOscillator || !humGain || !ctx) return;

    humGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);

    setTimeout(() => {
      try {
        humOscillator.stop();
      } catch {
        // Already stopped
      }
    }, 150);

    humOscillatorRef.current = null;
    humGainRef.current = null;
  }, []);

  const playKissLickLoop = useCallback(() => {
    if (kissLickAudioRef.current) return;

    const audio = new Audio('/assets/audio/kiss-lick.mp3');
    audio.loop = true;
    audio.play().catch(() => {
      // Autoplay blocked
    });
    kissLickAudioRef.current = audio;
  }, []);

  const stopKissLickLoop = useCallback(() => {
    if (!kissLickAudioRef.current) return;

    kissLickAudioRef.current.pause();
    kissLickAudioRef.current.currentTime = 0;
    kissLickAudioRef.current = null;
  }, []);

  return {
    initAudio,
    playBeep,
    startHum,
    stopHum,
    playKissLickLoop,
    stopKissLickLoop,
    isInitialized: isAudioInitialized,
  };
}
