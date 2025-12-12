import { SessionProvider } from './context/SessionContext';
import { WaveCanvas } from './components/WaveCanvas';
import { ControlPanel } from './components/ControlPanel';
import { SpeedControl } from './components/SpeedControl';
import { ConnectionStatus } from './components/ConnectionStatus';
import './styles/index.css';

function App() {
  return (
    <SessionProvider>
      <div className="app">
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

export default App;
