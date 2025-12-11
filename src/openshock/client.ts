export interface OpenShockConfig {
  apiToken: string;
  apiBase?: string;
}

type ControlType = 'Stop' | 'Shock' | 'Vibrate' | 'Sound';

interface ControlRequest {
  shocks: {
    id: string;
    type: ControlType;
    intensity: number;
    duration: number;
  }[];
  customName?: string;
}

export class OpenShockClient {
  private apiBase: string;

  constructor(private config: OpenShockConfig) {
    this.apiBase = config.apiBase ?? 'https://api.openshock.app';
  }

  private async sendControl(shockerId: string, type: ControlType, intensity: number, duration: number): Promise<void> {
    const body: ControlRequest = {
      shocks: [{
        id: shockerId,
        type,
        intensity: Math.max(0, Math.min(100, intensity)),
        duration: Math.max(300, Math.min(65535, duration)),
      }],
      customName: 'MotionTrainer',
    };

    try {
      const response = await fetch(`${this.apiBase}/2/shockers/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Open-Shock-Token': this.config.apiToken,
          'User-Agent': 'MotionTrainer/1.0',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`OpenShock API error (${response.status}):`, text);
      }
    } catch (err) {
      console.error('OpenShock request failed:', err);
    }
  }

  vibrate(shockerId: string, intensity: number, duration: number): void {
    this.sendControl(shockerId, 'Vibrate', intensity, duration);
  }

  beep(shockerId: string, duration: number): void {
    this.sendControl(shockerId, 'Sound', 0, duration);
  }

  shock(shockerId: string, intensity: number, duration: number): void {
    this.sendControl(shockerId, 'Shock', intensity, duration);
  }

  stop(shockerId: string): void {
    this.sendControl(shockerId, 'Stop', 0, 300);
  }
}
