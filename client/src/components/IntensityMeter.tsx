interface IntensityMeterProps {
  current: number;
  max: number;
}

export function IntensityMeter({ current, max }: IntensityMeterProps) {
  const percentage = Math.min((current / max) * 100, 100);

  // Interpolate from green (120) to red (0) in HSL
  const hue = 120 - (percentage / 100) * 120;
  const color = `hsl(${hue}, 70%, 50%)`;

  return (
    <div className="intensity-meter">
      <div className="intensity-meter-label">
        <span>Intensity</span>
        <span className="intensity-meter-value">{current}%</span>
      </div>
      <div className="intensity-meter-track">
        <div
          className="intensity-meter-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
