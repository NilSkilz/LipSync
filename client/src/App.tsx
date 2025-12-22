import { useState, useCallback } from 'react';
import { ConnectionProvider } from './context/ConnectionContext';
import { SessionProvider } from './context/SessionContext';
import { StartPage } from './components/StartPage';
import { LearnPage } from './components/LearnPage';
import { WaveCanvas } from './components/WaveCanvas';
import { ControlPanel } from './components/ControlPanel';
import { SpeedControl } from './components/SpeedControl';
import { ConnectionStatus } from './components/ConnectionStatus';
import { Settings } from './components/Settings';
import { PunishmentFlash } from './components/PunishmentFlash';
import './styles/index.css';

type Page = 'start' | 'learn' | 'play';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('start');

  const goToPlay = useCallback(() => setCurrentPage('play'), []);
  const goToLearn = useCallback(() => setCurrentPage('learn'), []);
  const goToStart = useCallback(() => setCurrentPage('start'), []);

  if (currentPage === 'start') {
    return <StartPage onPlay={goToPlay} onLearn={goToLearn} />;
  }

  if (currentPage === 'learn') {
    return <LearnPage onBack={goToStart} />;
  }

  return (
    <ConnectionProvider>
      <SessionProvider>
        <div className="app">
          <div className="play-header">
            <button className="back-btn" onClick={goToStart}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h1>LipSync</h1>
          </div>
          <WaveCanvas />
          <div className="main-content">
            <ControlPanel />
            <SpeedControl />
          </div>
          <ConnectionStatus />
          <Settings />
          <PunishmentFlash />
        </div>
      </SessionProvider>
    </ConnectionProvider>
  );
}

export default App;
