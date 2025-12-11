import { MotionSample, TargetParams, MotionResult } from '../types';

// Ring buffer to track recent samples
const BUFFER_SIZE = 100; // ~2 seconds at 50Hz
const samples: MotionSample[] = [];

// Track cycle detection
let lastPeakTime = 0;
let recentCycleTimes: number[] = [];
let minPitch = 0;
let maxPitch = 0;

export function evaluateMotion(
  sample: MotionSample,
  targets: TargetParams
): MotionResult {
  // Add to buffer
  samples.push(sample);
  if (samples.length > BUFFER_SIZE) samples.shift();

  // Need at least some samples to evaluate
  if (samples.length < 10) {
    return {
      currentPace: 0,
      currentDepth: 0,
      paceDeviation: 0,
      depthDeviation: 0,
      deviation: 0,
    };
  }

  // Track pitch range for depth calculation
  minPitch = Math.min(minPitch, sample.pitch);
  maxPitch = Math.max(maxPitch, sample.pitch);

  // Detect peaks (direction changes) for rhythm
  const isPeak = detectPeak(samples);
  
  if (isPeak) {
    const cycleTime = sample.timestamp - lastPeakTime;
    lastPeakTime = sample.timestamp;

    if (cycleTime > 200 && cycleTime < 5000) {
      // Valid cycle (between 12 and 300 BPM)
      recentCycleTimes.push(cycleTime);
      if (recentCycleTimes.length > 5) recentCycleTimes.shift();
    }

    // Reset depth tracking each cycle
    const depth = maxPitch - minPitch;
    minPitch = sample.pitch;
    maxPitch = sample.pitch;

    // Calculate current metrics
    const avgCycleTime = recentCycleTimes.length > 0
      ? recentCycleTimes.reduce((a, b) => a + b, 0) / recentCycleTimes.length
      : 0;
    
    const currentPace = avgCycleTime > 0 ? 60000 / avgCycleTime : 0;
    const currentDepth = depth;

    // Calculate deviations (0 = perfect, 1 = 100% off)
    const paceDeviation = targets.paceBPM > 0
      ? Math.abs(currentPace - targets.paceBPM) / targets.paceBPM
      : 0;

    const depthDeviation = targets.depthDegrees > 0
      ? Math.abs(currentDepth - targets.depthDegrees) / targets.depthDegrees
      : 0;

    // Combined deviation (weighted average)
    const deviation = (paceDeviation * 0.6) + (depthDeviation * 0.4);

    return {
      currentPace: Math.round(currentPace),
      currentDepth: Math.round(currentDepth),
      paceDeviation: Math.min(1, paceDeviation),
      depthDeviation: Math.min(1, depthDeviation),
      deviation: Math.min(1, deviation),
    };
  }

  // No peak detected, return last known values with no deviation trigger
  const avgCycleTime = recentCycleTimes.length > 0
    ? recentCycleTimes.reduce((a, b) => a + b, 0) / recentCycleTimes.length
    : 0;

  return {
    currentPace: avgCycleTime > 0 ? Math.round(60000 / avgCycleTime) : 0,
    currentDepth: Math.round(maxPitch - minPitch),
    paceDeviation: 0,
    depthDeviation: 0,
    deviation: 0, // Don't trigger between cycles
  };
}

function detectPeak(samples: MotionSample[]): boolean {
  if (samples.length < 3) return false;

  const curr = samples[samples.length - 1];
  const prev = samples[samples.length - 2];
  const prevPrev = samples[samples.length - 3];

  // Detect direction change in pitch (local max or min)
  const wasIncreasing = prev.pitch > prevPrev.pitch;
  const nowDecreasing = curr.pitch < prev.pitch;
  const wasDecreasing = prev.pitch < prevPrev.pitch;
  const nowIncreasing = curr.pitch > prev.pitch;

  // Require some minimum movement to avoid noise
  const movement = Math.abs(prev.pitch - prevPrev.pitch);
  if (movement < 2) return false;

  return (wasIncreasing && nowDecreasing) || (wasDecreasing && nowIncreasing);
}

// Reset state (call when session starts)
export function resetEvaluator() {
  samples.length = 0;
  lastPeakTime = 0;
  recentCycleTimes = [];
  minPitch = 0;
  maxPitch = 0;
}
