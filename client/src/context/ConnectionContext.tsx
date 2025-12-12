import { createContext, useContext, useCallback, type ReactNode } from 'react';

interface ConnectionContextValue {
  deviceUrl: string | null;
  isDevMode: boolean;
  disconnect: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

// Check if running in dev mode (localhost)
function isDevMode(): boolean {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

// Get WebSocket URL (null in dev mode)
function getDeviceUrl(): string | null {
  if (isDevMode()) {
    return null; // Don't connect in dev mode
  }
  const host = window.location.hostname;
  const port = window.location.port || '80';
  return `ws://${host}:${port}/ws`;
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const devMode = isDevMode();
  const deviceUrl = getDeviceUrl();

  const disconnect = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <ConnectionContext.Provider value={{ deviceUrl, isDevMode: devMode, disconnect }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}
