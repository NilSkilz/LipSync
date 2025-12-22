interface StartPageProps {
  onPlay: () => void;
  onLearn: () => void;
}

export function StartPage({ onPlay, onLearn }: StartPageProps) {
  return (
    <div className="start-page">
      <div className="start-content">
        <div className="start-logo">
          <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="35" width="12" height="30" rx="6" fill="#d44a94"/>
            <rect x="28" y="20" width="12" height="45" rx="6" fill="#ff69b4"/>
            <rect x="46" y="10" width="12" height="60" rx="6" fill="#ff69b4"/>
            <rect x="64" y="25" width="12" height="40" rx="6" fill="#ff69b4"/>
            <rect x="82" y="40" width="12" height="25" rx="6" fill="#d44a94"/>
          </svg>
        </div>
        <h1 className="start-title">LipSync</h1>
        <p className="start-subtitle">Follow the rhythm, feel the feedback</p>

        <div className="start-buttons">
          <button className="start-btn play" onClick={onPlay}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span>Play</span>
          </button>

          <button className="start-btn learn" onClick={onLearn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
            <span>Learn</span>
          </button>
        </div>
      </div>
    </div>
  );
}
