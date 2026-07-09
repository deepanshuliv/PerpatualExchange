import { Router } from 'express';
import authenticationRoutes from './authentication';
import exchangeRoutes from './exchange';
import simulationRoutes from './simulation';

const appRouter = Router();

appRouter.use(authenticationRoutes);
appRouter.use(simulationRoutes);
appRouter.use(exchangeRoutes);

export default appRouter;
