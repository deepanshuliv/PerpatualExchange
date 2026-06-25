import z from 'zod';

import {
  CANCEL_ORDER_RESPONSE_SCHEMA,
  CREATE_ORDER_RESPONSE_SCHEMA,
  LIQUIDATION_EVENT_SCHEMA,
  MARKPRICE_UPDATED_RESPONSE_SCHEMA,
  BOOKTICKER_UPDATED_RESPONSE_SCHEMA,
} from '../engine-types/engine-response';
import { KIND_SCHEMA, MARKET_AVAILABEL_SCHEMA } from '../shared';

const FILL_SCHEMA = z.object({
  price: z.number(),
  qty: z.number(),
});

const SIDE_SCHEMA = z.union([z.literal('bids'), z.literal('asks')]);

export const WS_MARKET_UPDATE_RESPONSE_SCHEMA = z.object({
  market: MARKET_AVAILABEL_SCHEMA,
  kind: KIND_SCHEMA,           // "LONG" | "SHORT"
  side: SIDE_SCHEMA,           // "bids" | "asks"
  fills: z.array(FILL_SCHEMA), // [{ price, qty }, ...]
  transactionTime: z.number().optional(),
  executionTime: z.number().optional(),
});

export type WebsocketResponse = z.infer<typeof WS_MARKET_UPDATE_RESPONSE_SCHEMA>;


export const WsStreamingResponse = z.union([
  CREATE_ORDER_RESPONSE_SCHEMA,
  CANCEL_ORDER_RESPONSE_SCHEMA,
  LIQUIDATION_EVENT_SCHEMA,
  MARKPRICE_UPDATED_RESPONSE_SCHEMA,
  BOOKTICKER_UPDATED_RESPONSE_SCHEMA,
]);

export const WS_SUBSCRIBE_SCHEMA = z.object({
  method: z.enum(['SUBSCRIBE', 'UNSUBSCRIBE']),
  params: z.array(z.string()),
  id: z.union([z.number(), z.string()]).optional(),
});

export type WS_SUBSCRIBE = z.infer<typeof WS_SUBSCRIBE_SCHEMA>;

export const WS_ERROR_SCHEMA = z.object({
  error: z.string(),
});

export type errorSchema = z.infer<typeof WS_ERROR_SCHEMA>;
