import z from 'zod';

import { WS_BROADCAST_EVENT_SCHEMA } from '../engine-types/engine-response';

/** WS consumer only processes broadcast events from the engine (no RPC replies). */
export const WsStreamingResponse = WS_BROADCAST_EVENT_SCHEMA;

export type WsStreamingMessage = z.infer<typeof WsStreamingResponse>;

export const WS_SUBSCRIBE_SCHEMA = z.object({
  method: z.enum(['SUBSCRIBE', 'UNSUBSCRIBE']),
  params: z.array(z.string()),
  id: z.union([z.number(), z.string()]).optional(),
});
