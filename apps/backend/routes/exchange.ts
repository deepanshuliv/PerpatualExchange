import { Router } from 'express';
import { isAuth } from '../middleware/authentication';
import {
  onRamp,
  createOrder,
  cancelOrder,
  getAvailableEquity,
  getOpenPositions,
  getClosedPositions,
  getOpenOrders,
  getAllOrders,
  getFills,
  getDepth,
  getTickerPrice,
} from '../controller/exchange';

const exchangeRoutes = Router();

exchangeRoutes.post('/onramp', isAuth, onRamp);
exchangeRoutes.post('/order', isAuth, createOrder); // create_order
exchangeRoutes.post('/order/cancel', isAuth, cancelOrder); // cancel_order
exchangeRoutes.get('/equity/available', isAuth, getAvailableEquity); // get_positions
exchangeRoutes.get('/positions/open/:marketId', isAuth, getOpenPositions); // db request 
exchangeRoutes.get('/positions/closed/:marketId', isAuth, getClosedPositions); // db request
exchangeRoutes.get('/orders/open/:marketId', isAuth, getOpenOrders);
exchangeRoutes.get('/orders/:marketId', isAuth, getAllOrders);
exchangeRoutes.get('/fills', isAuth, getFills);
exchangeRoutes.get('/depth/:marketId', getDepth);
exchangeRoutes.get('/ticker/price/:marketId', getTickerPrice);

export default exchangeRoutes;
