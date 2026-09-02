import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { broadcaster } from '../broadcaster.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req: Request, res: Response) => {
  const isHealthy = await db.checkHealth();
  const poolStats = db.getPoolStats();

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    db_connected: isHealthy,
    ws_clients_count: broadcaster.getClientCount(),
    pool_free: poolStats.free,
    pool_used: poolStats.used,
    timestamp: new Date().toISOString(),
  });
});
