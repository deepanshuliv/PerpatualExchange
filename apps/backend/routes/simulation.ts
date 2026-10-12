import { Router, type NextFunction, type Request, type Response } from 'express';
import { injectMarkPrice, provisionSimUser } from '../controller/simulation';

const simulationRoutes = Router();

/**
 * The simulation routes mint funded users and move the mark price (which can
 * liquidate real positions), so they are off unless ENABLE_SIM_ROUTES=true.
 */
function requireSimEnabled(_req: Request, res: Response, next: NextFunction) {
  if (process.env.ENABLE_SIM_ROUTES !== 'true') {
    return res.status(403).json({ msg: 'Simulation routes are disabled on this server' });
  }
  next();
}

simulationRoutes.post('/sim/provision', requireSimEnabled, provisionSimUser);
simulationRoutes.post('/sim/inject-mark-price', requireSimEnabled, injectMarkPrice);

export default simulationRoutes;
