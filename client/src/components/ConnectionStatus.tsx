import { useSession } from '../context/SessionContext';

export function ConnectionStatus() {
  const { state } = useSession();
  const { isConnected } = state;

  return (
    <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
      {isConnected ? 'Connected' : 'Disconnected - Reconnecting...'}
    </div>
  );
}
