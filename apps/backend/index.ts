import 'dotenv/config';
import express from "express";
import cors from "cors";
import appRouter from "./routes";
import { initializeRedis } from "./utils/toEngine";

const app = express();

// Allow requests from any origin in development (frontend runs on different port)
app.use(cors());
app.use(express.json());

app.use(appRouter);

async function startServer() {
  try {
    console.log("Connecting to Redis...");
    await initializeRedis();
    console.log("Redis connected successfully.");

    app.listen(3000, () => {
        console.log("server is running on port ", 3000)
    });
  } catch (error) {
    console.error("Failed to initialize Redis streams:", error);
    process.exit(1);
  }
}

startServer();