import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { db } from './db.js';
import { broadcaster } from './broadcaster.js';
import { healthRouter } from './routes/health.js';
import { layoutRouter } from './routes/layout.js';
import { telemetryRouter } from './routes/telemetry.js';

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// REST Routes
app.use('/api', healthRouter);
app.use('/api', layoutRouter);
app.use('/api', telemetryRouter);

app.get('/', (req, res) => {
  res.json({
    service: config.APP_NAME,
    runtime: `Node.js ${process.version}`,
    status: 'running',
    endpoints: {
      health: '/api/health',
      machines: '/api/machines',
      snapshot: '/api/snapshot',
      history: '/api/history/:eqp_id',
      layout: '/api/layout',
      websocket: '/ws/ldi',
    },
  });
});

// Create HTTP Server
const server = http.createServer(app);

// Create WebSocket Server attached to HTTP Server
const wss = new WebSocketServer({ server, path: '/ws/ldi' });

wss.on('connection', (ws, req) => {
  broadcaster.addClient(ws);
});

// Server Initialization
async function bootstrap() {
  console.log(`[floorplan.main] Initializing ${config.APP_NAME} (Node.js runtime)...`);

  // Connect to database with retry
  await db.connectWithRetry(5, 1000);

  // Start background telemetry broadcaster loop
  broadcaster.start();

  // Start HTTP and WebSocket listener
  server.listen(config.PORT, '0.0.0.0', () => {
    console.log(`[floorplan.main] Server running on http://0.0.0.0:${config.PORT}`);
    console.log(`[floorplan.main] WebSocket active on ws://0.0.0.0:${config.PORT}/ws/ldi`);
  });
}

// Graceful Shutdown
async function shutdown() {
  console.log('[floorplan.main] Shutting down gracefully...');
  broadcaster.stop();
  wss.close();
  server.close(async () => {
    await db.disconnect();
    console.log('[floorplan.main] Shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

bootstrap().catch((err) => {
  console.error('[floorplan.main] Fatal bootstrap error:', err);
  process.exit(1);
});
