import { useSession } from '../context/SessionContext';
import { useConnection } from '../context/ConnectionContext';

export function ConnectionStatus() {
  const { state } = useSession();
  const { isDevMode } = useConnection();
  const { isConnected } = state;

  if (isDevMode) {
    return (
      <div className="connection-status connected">
        Dev Mode
      </div>
    );
  }

  return (
    <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
      {isConnected ? 'Connected' : 'Disconnected - Reconnecting...'}
    </div>
  );
}
