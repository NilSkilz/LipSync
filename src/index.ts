import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenShockClient } from './openshock/client.js';
import { SessionState, CycleEvent, CycleResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve React client build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
}

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Session state
const session: SessionState = {
  active: false,
  targets: {
    paceBPM: 60,
    depthDegrees: 30,
    tolerance: 0.3,
  },
  feedbackIntensity: 50,
  shockerId: process.env.OPENSHOCK_SHOCKER_ID || '',
};

// Connected clients
const clients = {
  phone: null as WebSocket | null,
  sensor: null as WebSocket | null,
};

// OpenShock client
const openshock = new OpenShockClient({
  apiToken: process.env.OPENSHOCK_API_TOKEN || '',
});

// Health check
app.get('/health', (_, res) => res.send('ok'));

wss.on('connection', (ws, req) => {
  const clientType = req.url?.includes('sensor') ? 'sensor' : 'phone';
  clients[clientType] = ws;
  console.log(`${clientType} connected`);

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      await handleMessage(clientType, msg);
    } catch (e) {
      console.error('Message parse error:', e);
    }
  });

  ws.on('close', () => {
    clients[clientType] = null;
    console.log(`${clientType} disconnected`);
  });

  // Send current state to phone on connect
  if (clientType === 'phone') {
    ws.send(JSON.stringify({ type: 'state', data: session }));
  }

  // Send session status to sensor on connect
  if (clientType === 'sensor') {
    ws.send(JSON.stringify({
      type: 'sessionStatus',
      data: { active: session.active }
    }));
  }
});

async function handleMessage(
  from: 'phone' | 'sensor',
  msg: { type: string; data?: any }
) {
  switch (msg.type) {
    // Phone commands
    case 'setTargets':
      session.targets = { ...session.targets, ...msg.data };
      console.log('setTargets:', msg.data);
      broadcast({ type: 'targetsUpdated', data: session.targets });
      break;

    case 'setIntensity':
      session.feedbackIntensity = msg.data.intensity;
      console.log('setIntensity:', msg.data.intensity);
      break;

    case 'start':
      session.active = true;
      console.log('start');
      broadcast({ type: 'sessionStarted' });
      // Notify sensor to start tracking
      clients.sensor?.send(JSON.stringify({
        type: 'sessionStatus',
        data: { active: true }
      }));
      break;

    case 'stop':
      session.active = false;
      console.log('stop');
      broadcast({ type: 'sessionStopped' });
      clients.sensor?.send(JSON.stringify({
        type: 'sessionStatus',
        data: { active: false }
      }));
      break;

    case 'testVibrate':
      console.log('testVibrate:', msg.data?.intensity ?? 30);
      await openshock.vibrate(
        session.shockerId,
        msg.data?.intensity ?? 30,
        300
      );
      break;

    case 'testBeep':
      console.log('testBeep');
      await openshock.beep(session.shockerId, 300);
      break;

    case 'setMode':
      console.log('setMode:', msg.data);
      // Forward mode changes to sensor
      clients.sensor?.send(JSON.stringify({
        type: 'modeChanged',
        data: msg.data
      }));
      break;

    // Sensor events
    case 'cycle':
      if (!session.active) return;

      const cycle: CycleEvent = msg.data;
      const result = evaluateCycle(cycle);

      // Send result to phone for display
      clients.phone?.send(JSON.stringify({
        type: 'cycleResult',
        data: { cycle, result }
      }));

      // Trigger feedback if deviation exceeds tolerance
      if (result.deviation > session.targets.tolerance) {
        const intensity = Math.min(
          Math.round(session.feedbackIntensity * (0.5 + result.deviation * 0.5)),
          100
        );
        await openshock.vibrate(session.shockerId, intensity, 200);
      }
      break;
  }
}

function evaluateCycle(cycle: CycleEvent): CycleResult {
  const expectedDuration = 60000 / session.targets.paceBPM;

  const paceDeviation = expectedDuration > 0
    ? Math.abs(cycle.duration - expectedDuration) / expectedDuration
    : 0;

  const depthDeviation = session.targets.depthDegrees > 0
    ? Math.abs(cycle.depth - session.targets.depthDegrees) / session.targets.depthDegrees
    : 0;

  // Weight pace slightly higher than depth
  const deviation = (paceDeviation * 0.6) + (depthDeviation * 0.4);

  const currentBPM = cycle.duration > 0 ? Math.round(60000 / cycle.duration) : 0;

  return {
    currentBPM,
    currentDepth: Math.round(cycle.depth),
    paceDeviation: Math.min(1, paceDeviation),
    depthDeviation: Math.min(1, depthDeviation),
    deviation: Math.min(1, deviation),
    feedback: deviation > session.targets.tolerance,
  };
}

function broadcast(msg: object) {
  const payload = JSON.stringify(msg);
  clients.phone?.send(payload);
}

// SPA catch-all route for production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});