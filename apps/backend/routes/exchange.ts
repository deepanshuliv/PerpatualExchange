import { Router } from 'express';
import { isAuth } from '../middleware/authentication';
import {
  onRamp,
  createOrder,
  cancelOrder,
  getAvailableEquity,
  getOpenPositions,
  getOpenOrders,
  getFills,
  getDepth,
  getTickerPrice,
} from '../controller/exchange';

const exchangeRoutes = Router();

exchangeRoutes.post('/onramp', isAuth, onRamp);
exchangeRoutes.post('/order', isAuth, createOrder);
exchangeRoutes.post('/order/cancel', isAuth, cancelOrder);
exchangeRoutes.get('/equity/available', isAuth, getAvailableEquity);
exchangeRoutes.get('/positions/open/:marketId', isAuth, getOpenPositions);
exchangeRoutes.get('/orders/open/:marketId', isAuth, getOpenOrders);
exchangeRoutes.get('/fills', isAuth, getFills);
exchangeRoutes.get('/depth/:marketId', getDepth);
exchangeRoutes.get('/ticker/price/:marketId', getTickerPrice);

export default exchangeRoutes;
