import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { broadcaster } from '../broadcaster.js';

export const telemetryRouter = Router();

telemetryRouter.get('/machines', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT DISTINCT ON (eqp_id)
        eqp_id,
        CASE WHEN state = true THEN 1 ELSE 2 END AS status,
        "time" AS last_seen
      FROM public.ldi_data
      ORDER BY eqp_id, "time" DESC;
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err: any) {
    console.error('[floorplan.routes.telemetry] Failed to fetch machines:', err.message);
    res.status(500).json({ error: err.message });
  }
});

telemetryRouter.get('/snapshot', async (req: Request, res: Response) => {
  try {
    const machines = await broadcaster.fetchTelemetry();
    const machineMap: Record<string, any> = {};
    for (const m of machines) {
      machineMap[m.eqp_id] = m;
    }

    res.json({
      type: 'telemetry_snapshot',
      timestamp: new Date().toISOString(),
      count: machines.length,
      machines: machineMap,
      list: machines,
    });
  } catch (err: any) {
    console.error('[floorplan.routes.telemetry] Failed to fetch snapshot:', err.message);
    res.status(500).json({ error: err.message });
  }
});

telemetryRouter.get('/history/:eqp_id', async (req: Request, res: Response) => {
  const { eqp_id } = req.params;
  const limit = parseInt(req.query.limit as string || '50', 10);

  try {
    const query = `
      SELECT
        "time",
        eqp_id,
        state,
        ROUND(temperature::NUMERIC, 1) AS temperature,
        ROUND(humidity::NUMERIC, 1) AS humidity,
        ROUND(resist_dosage::NUMERIC, 2) AS resist_dosage,
        ROUND(scan_speed::NUMERIC, 1) AS scan_speed,
        ROUND(air_vacuum::NUMERIC, 1) AS air_vacuum,
        ROUND(thickness::NUMERIC, 3) AS thickness,
        board_no,
        total_board,
        ROUND(total_time::NUMERIC, 1) AS total_time,
        mo,
        fpn,
        layer_name
      FROM public.ldi_data
      WHERE eqp_id = $1
      ORDER BY "time" DESC
      LIMIT $2;
    `;
    const result = await db.query(query, [eqp_id, limit]);
    res.json(result.rows);
  } catch (err: any) {
    console.error(`[floorplan.routes.telemetry] Failed to fetch history for ${eqp_id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});
