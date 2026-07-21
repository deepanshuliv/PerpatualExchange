import type { EngineRequest } from '@repo/shared-types';
import type { Response } from 'express';
import { sendToEngine } from './toEngine';

export async function callEngine(
  res: Response,
  engineRequest: EngineRequest.BACKEND_ENGINE_REQUEST,
  statusCode = 200,
) {
  try {
    const reply = await sendToEngine(engineRequest);

    if (!reply) {
      return res.status(403).json({ msg: 'some error occured' });
    }

    if (reply.type === 'error') {
      return res.status(400).json({ msg: reply.payload.error });
    }

    return res.status(statusCode).json({ ok: true, data: reply.payload });
  } catch (err: any) {
    console.log('[callEngine] error', err);
    return res.status(504).json({ msg: err?.message || 'Engine timeout' });
  }
}
