import { useCallback, useState } from 'react';
import { useSession } from '../context/SessionContext';
import type { PunishmentMode } from '../types';

export function Settings() {
  const { state, actions } = useSession();
  const { settingsOpen, punishmentMode, maxIntensity, increasingIntensity } = state;
  const [testIntensity, setTestIntensity] = useState(30);

  const handlePunishmentModeChange = useCallback((mode: PunishmentMode) => {
    actions.setPunishmentMode(mode);
  }, [actions]);

  const handleMaxIntensityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    actions.setMaxIntensity(value);
  }, [actions]);

  const handleIncreasingIntensityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    actions.setIncreasingIntensity(e.target.checked);
  }, [actions]);

  const handleTestIntensityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTestIntensity(parseInt(e.target.value, 10));
  }, []);

  const handleTestVibrate = useCallback(() => {
    actions.testVibrate(testIntensity);
  }, [actions, testIntensity]);

  const handleTestShock = useCallback(() => {
    actions.testShock(testIntensity);
  }, [actions, testIntensity]);

  const handleTestBeep = useCallback(() => {
    actions.testBeep();
  }, [actions]);

  const handleClose = useCallback(() => {
    actions.toggleSettings();
  }, [actions]);

  if (!settingsOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="settings-section">
          <h3>Punishment Mode</h3>
          <div className="punishment-modes">
            <button
              className={`mode-btn ${punishmentMode === 'off' ? 'active' : ''}`}
              onClick={() => handlePunishmentModeChange('off')}
            >
              Off
            </button>
            <button
              className={`mode-btn ${punishmentMode === 'beep' ? 'active' : ''}`}
              onClick={() => handlePunishmentModeChange('beep')}
            >
              Beep
            </button>
            <button
              className={`mode-btn ${punishmentMode === 'vibrate' ? 'active' : ''}`}
              onClick={() => handlePunishmentModeChange('vibrate')}
            >
              Vibrate
            </button>
            <button
              className={`mode-btn ${punishmentMode === 'shock' ? 'active' : ''}`}
              onClick={() => handlePunishmentModeChange('shock')}
            >
              Shock
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h3>Max Intensity</h3>
          <div className="intensity-slider">
            <input
              type="range"
              min="1"
              max="100"
              value={maxIntensity}
              onChange={handleMaxIntensityChange}
            />
            <span className="intensity-value">{maxIntensity}%</span>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={increasingIntensity}
              onChange={handleIncreasingIntensityChange}
            />
            <span>Increasing intensity (starts low, builds up)</span>
          </label>
        </div>

        <div className="settings-section">
          <h3>Test Controls</h3>
          <div className="intensity-slider">
            <label>Test Intensity</label>
            <input
              type="range"
              min="1"
              max="100"
              value={testIntensity}
              onChange={handleTestIntensityChange}
            />
            <span className="intensity-value">{testIntensity}%</span>
          </div>
          <div className="test-buttons">
            <button className="test-btn" onClick={handleTestBeep}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Beep
            </button>
            <button className="test-btn" onClick={handleTestVibrate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12c2-4 4-6 6-6s4 4 6 4 4-4 6-4c2 0 4 2 6 6" />
              </svg>
              Vibrate
            </button>
            <button className="test-btn shock" onClick={handleTestShock}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Shock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
