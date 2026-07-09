import { Router } from 'express';
import { injectMarkPrice, provisionSimUser } from '../controller/simulation';

const simulationRoutes = Router();

simulationRoutes.post('/sim/provision', provisionSimUser);
simulationRoutes.post('/sim/inject-mark-price', injectMarkPrice);

export default simulationRoutes;
