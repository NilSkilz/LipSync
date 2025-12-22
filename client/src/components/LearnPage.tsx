import { useCallback, useRef, useState } from 'react';
import { useAudio } from '../hooks/useAudio';

interface LearnPageProps {
  onBack: () => void;
}

export function LearnPage({ onBack }: LearnPageProps) {
  const { initAudio, playBeep, startHum, stopHum, stopKissLickLoop } = useAudio(true);
  const [humActive, setHumActive] = useState(false);
  const [kissLickActive, setKissLickActive] = useState(false);
  const kissLickRef = useRef<HTMLAudioElement | null>(null);

  const handleInit = useCallback(() => {
    initAudio();
  }, [initAudio]);

  const playInSound = useCallback(() => {
    initAudio();
    playBeep(880, 0.15); // High beep
  }, [initAudio, playBeep]);

  const playOutSound = useCallback(() => {
    initAudio();
    playBeep(440, 0.15); // Low beep
  }, [initAudio, playBeep]);

  const toggleDeepthroat = useCallback(() => {
    initAudio();
    if (humActive) {
      stopHum();
      setHumActive(false);
    } else {
      startHum();
      setHumActive(true);
    }
  }, [initAudio, humActive, startHum, stopHum]);

  const toggleKissLick = useCallback(() => {
    if (kissLickActive) {
      if (kissLickRef.current) {
        kissLickRef.current.pause();
        kissLickRef.current.currentTime = 0;
        kissLickRef.current = null;
      }
      stopKissLickLoop();
      setKissLickActive(false);
    } else {
      const audio = new Audio('/assets/audio/kiss-lick.mp3');
      audio.loop = true;
      audio.play().catch(() => {});
      kissLickRef.current = audio;
      setKissLickActive(true);
    }
  }, [kissLickActive, stopKissLickLoop]);

  const handleBack = useCallback(() => {
    // Clean up any playing sounds
    stopHum();
    if (kissLickRef.current) {
      kissLickRef.current.pause();
      kissLickRef.current = null;
    }
    stopKissLickLoop();
    onBack();
  }, [onBack, stopHum, stopKissLickLoop]);

  return (
    <div className="learn-page" onClick={handleInit}>
      <div className="learn-header">
        <button className="back-btn" onClick={handleBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>How It Works</h1>
      </div>

      <div className="learn-content">
        <section className="learn-section">
          <h2>The Basics</h2>
          <p>
            LipSync guides you through rhythmic movements using audio cues
            and visual feedback. Follow the wave pattern on screen and listen for
            the beeps to stay in sync.
          </p>
        </section>

        <section className="learn-section">
          <h2>Movement Sounds</h2>
          <p>Two beeps guide your movement cycle:</p>

          <div className="sound-demo-row">
            <button className="sound-btn" onClick={playInSound}>
              <span className="sound-icon">&#x2191;</span>
              <span>In / Up</span>
              <span className="sound-note">High beep</span>
            </button>

            <button className="sound-btn" onClick={playOutSound}>
              <span className="sound-icon">&#x2193;</span>
              <span>Out / Down</span>
              <span className="sound-note">Low beep</span>
            </button>
          </div>
        </section>

        <section className="learn-section">
          <h2>Special Modes</h2>
          <p>Two hold modes pause the rhythm:</p>

          <div className="sound-demo-row">
            <button className={`sound-btn ${humActive ? 'active' : ''}`} onClick={toggleDeepthroat}>
              <span className="sound-icon">&#x25CF;</span>
              <span>Deepthroat</span>
              <span className="sound-note">{humActive ? 'Tap to stop' : 'Hold position'}</span>
            </button>

            <button className={`sound-btn ${kissLickActive ? 'active' : ''}`} onClick={toggleKissLick}>
              <span className="sound-icon">&#x2665;</span>
              <span>Kiss & Lick</span>
              <span className="sound-note">{kissLickActive ? 'Tap to stop' : 'Follow audio'}</span>
            </button>
          </div>
        </section>

        <section className="learn-section">
          <h2>Speed Control</h2>
          <p>
            Use the slider on the right to adjust the pace. Slide up for faster,
            down for slower. The wave pattern will adjust to match.
          </p>
        </section>

        <section className="learn-section">
          <h2>Feedback</h2>
          <p>
            When connected to the device, you'll receive haptic feedback if you
            fall out of rhythm. The intensity and type of feedback can be
            configured in settings.
          </p>
          <ul className="feedback-list">
            <li><strong>Beep</strong> - Audio alert only</li>
            <li><strong>Vibrate</strong> - Gentle vibration reminder</li>
            <li><strong>Shock</strong> - Warning vibrate, then shock if repeated</li>
          </ul>
        </section>

        <section className="learn-section">
          <h2>The Wave</h2>
          <p>
            The pink wave shows the target rhythm. A cyan line shows your actual
            movement when the motion sensor is connected. Try to match the curves!
          </p>
        </section>

        <button className="start-training-btn" onClick={handleBack}>
          Start Training
        </button>
      </div>
    </div>
  );
}
