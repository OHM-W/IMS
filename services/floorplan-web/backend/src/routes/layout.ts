import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { LayoutData, MachineCustomDef } from '../types.js';

export const layoutRouter = Router();

layoutRouter.get('/layout', (req: Request, res: Response) => {
  try {
    if (fs.existsSync(config.LAYOUT_FILE)) {
      const raw = fs.readFileSync(config.LAYOUT_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return res.json({ custom: true, ...data });
    }
    return res.json({ custom: false, machines: [], deletedIds: [] });
  } catch (err: any) {
    console.error('[floorplan.routes.layout] Failed to read custom layout:', err.message);
    return res.json({ custom: false, machines: [], deletedIds: [] });
  }
});

layoutRouter.post('/layout', (req: Request, res: Response) => {
  try {
    const { machines = [], deletedIds = [] } = req.body as {
      machines: MachineCustomDef[];
      deletedIds: string[];
    };

    if (!fs.existsSync(config.DATA_DIR)) {
      fs.mkdirSync(config.DATA_DIR, { recursive: true });
    }

    const data: LayoutData = {
      custom: true,
      machines,
      deletedIds,
    };

    fs.writeFileSync(config.LAYOUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[floorplan.routes.layout] Saved ${machines.length} custom machines (deleted: ${deletedIds.length})`);

    return res.json({
      status: 'success',
      machine_count: machines.length,
    });
  } catch (err: any) {
    console.error('[floorplan.routes.layout] Failed to save custom layout:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

layoutRouter.delete('/layout', (req: Request, res: Response) => {
  try {
    if (fs.existsSync(config.LAYOUT_FILE)) {
      fs.unlinkSync(config.LAYOUT_FILE);
      console.log('[floorplan.routes.layout] Custom layout reset to default.');
    }
    return res.json({ status: 'reset' });
  } catch (err: any) {
    console.error('[floorplan.routes.layout] Failed to reset layout:', err.message);
    return res.status(500).json({ error: err.message });
  }
});
