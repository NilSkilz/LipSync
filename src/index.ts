import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { OpenShockClient } from './openshock/client.js';
import { SessionState, TargetParams, MotionSample } from './types.js';
import { evaluateMotion, resetEvaluator } from './motion/evaluator.js';

const app = express();
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Session state - shared across connections
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

// Track connected clients
const clients = {
  phone: null as WebSocket | null,
  sensor: null as WebSocket | null,
};

// OpenShock client
const openshock = new OpenShockClient({
  apiToken: process.env.OPENSHOCK_API_TOKEN || '',
});

// Health check for Railway
app.get('/health', (_, res) => res.send('ok'));

wss.on('connection', (ws, req) => {
  const clientType = req.url?.includes('sensor') ? 'sensor' : 'phone';
  clients[clientType] = ws;
  console.log(`${clientType} connected`);

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      await handleMessage(clientType, msg, ws);
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
});

async function handleMessage(
  from: 'phone' | 'sensor',
  msg: { type: string; data?: any },
  ws: WebSocket
) {
  switch (msg.type) {
    // Phone commands
    case 'setTargets':
      session.targets = { ...session.targets, ...msg.data };
      broadcast({ type: 'targetsUpdated', data: session.targets });
      break;

    case 'setIntensity':
      session.feedbackIntensity = msg.data.intensity;
      break;

    case 'start':
      session.active = true;
      resetEvaluator();
      broadcast({ type: 'sessionStarted' });
      break;

    case 'stop':
      session.active = false;
      broadcast({ type: 'sessionStopped' });
      break;

    case 'testVibrate':
      await openshock.vibrate(session.shockerId, msg.data?.intensity ?? 30, 100);
      break;

    // Sensor data
    case 'motion':
      if (!session.active) return;
      
      const sample: MotionSample = msg.data;
      const result = evaluateMotion(sample, session.targets);

      // Send to phone for visualization
      clients.phone?.send(JSON.stringify({ 
        type: 'motionUpdate', 
        data: { sample, result } 
      }));

      // Trigger feedback if deviation detected
      if (result.deviation > session.targets.tolerance) {
        const intensity = Math.min(
          session.feedbackIntensity * result.deviation,
          100
        );
        await openshock.vibrate(session.shockerId, Math.round(intensity), 300);
      }
      break;
  }
}

function broadcast(msg: object) {
  const payload = JSON.stringify(msg);
  clients.phone?.send(payload);
  clients.sensor?.send(payload);
}

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
