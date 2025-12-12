import { ConnectionProvider, useConnection } from './context/ConnectionContext';
import { SessionProvider } from './context/SessionContext';
import { ConnectionPage } from './components/ConnectionPage';
import { WaveCanvas } from './components/WaveCanvas';
import { ControlPanel } from './components/ControlPanel';
import { SpeedControl } from './components/SpeedControl';
import { ConnectionStatus } from './components/ConnectionStatus';
import './styles/index.css';

function MainApp() {
  const { disconnect } = useConnection();

  return (
    <SessionProvider>
      <div className="app">
        <button className="disconnect-btn" onClick={disconnect}>
          Disconnect
        </button>
        <WaveCanvas />
        <div className="main-content">
          <ControlPanel />
          <SpeedControl />
        </div>
        <ConnectionStatus />
      </div>
    </SessionProvider>
  );
}

function AppContent() {
  const { deviceUrl } = useConnection();

  if (!deviceUrl) {
    return <ConnectionPage />;
  }

  return <MainApp />;
}

function App() {
  return (
    <ConnectionProvider>
      <AppContent />
    </ConnectionProvider>
  );
}

export default App;
