import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import appRouter from './routes';
import { initializeRedis } from './utils/toEngine';

const app = express();

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || 'https://exchange.deepanshu.live,http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl, health checks, server-to-server calls) have no Origin header.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(appRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log('[errorHandler] error', err);
  res.status(500).json({ msg: err?.message || 'Internal server error' });
});

async function startServer() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing');
    }

    console.log('Connecting to Redis...');
    await initializeRedis();
    console.log('Redis connected successfully.');

    const port = Number(process.env.PORT || 3001);
    const host = process.env.HOST || '0.0.0.0';

    app.listen(port, host, () => {
      console.log(`server is running on ${host}:${port}`);
    });
  } catch (error) {
    console.log('[startServer] error', error);
    process.exit(1);
  }
}

startServer();
