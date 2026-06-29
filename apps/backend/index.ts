import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import appRouter from './routes';
import { initializeRedis } from './utils/toEngine';

const app = express();

app.use(cors());
app.use(express.json());

app.use(appRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log('Unhandled API error:', err);
  res.status(500).json({ msg: err?.message || 'Internal server error' });
});

async function startServer() {
  try {
    console.log('Connecting to Redis...');
    await initializeRedis();
    console.log('Redis connected successfully.');

    app.listen(3001, () => {
      console.log('server is running on port ', 3001);
    });
  } catch (error) {
    console.log('Failed to initialize Redis streams:', error);
    process.exit(1);
  }
}

startServer();
