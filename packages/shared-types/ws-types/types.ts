import z from 'zod';

import {
  CANCEL_ORDER_RESPONSE_SCHEMA,
  CREATE_ORDER_RESPONSE_SCHEMA,
  LIQUIDATION_EVENT_SCHEMA,
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
});

export type WebsocketResponse = z.infer<typeof WS_MARKET_UPDATE_RESPONSE_SCHEMA>;


export const WS_MARKET_SUBSCRIBE_RESPONSE_SCHEMA = z.object({
  success: z.literal(true),
  type: z.literal('subscribed'),
  market: MARKET_AVAILABEL_SCHEMA,
  msg: z.string(),
});

export const WsStreamingResponse = z.union([
  CREATE_ORDER_RESPONSE_SCHEMA,
  CANCEL_ORDER_RESPONSE_SCHEMA,
  LIQUIDATION_EVENT_SCHEMA,
]);

export type marketSubscribeType = z.infer<typeof WS_MARKET_SUBSCRIBE_RESPONSE_SCHEMA>;

export const WS_MARKET_UNSUBSCRIBE_RESPONSE_SCHEMA = z.object({
  success: z.literal(true),
  type: z.literal('unsubscribed'),
  market: MARKET_AVAILABEL_SCHEMA,
  msg: z.string(),
});

export type marketUnsubscribeType = z.infer<typeof WS_MARKET_UNSUBSCRIBE_RESPONSE_SCHEMA>;

export const WS_REQUEST_SCHEMA = z.union([
  z.object({
    type: z.literal('subscribe'),
    market: MARKET_AVAILABEL_SCHEMA,
    userId: z.string(),
  }),
  z.object({
    type: z.literal('unsubscribe'),
    market: MARKET_AVAILABEL_SCHEMA,
    userId: z.string(),
  }),
]);

export type requestSchema = z.infer<typeof WS_REQUEST_SCHEMA>;

export const WS_ERROR_SCHEMA = z.object({
  error: z.string(),
});

export type errorSchema = z.infer<typeof WS_ERROR_SCHEMA>;
