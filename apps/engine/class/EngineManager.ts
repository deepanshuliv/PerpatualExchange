import { redisClient, type RedisClientType } from "@repo/redis";
import BinanceClassListner from "./binanceListner";
import PostionManager from "./PositionManager";
import MatchingEngine from "./matchingEngine";
import { EngineRequest, EngineResponse, Shared } from "shared-types";
import { allMarketsList } from "../../../packages/shared-types/shared";
import fs from "node:fs/promises";
import path from "node:path";
import type { EngineSnapShotInstanceType } from "shared-types/internal-types";

type RedisStreamResponse = Array<{
  name: string;
  messages: Array<{
    id: string;
    message: Record<string, string>;
  }>;
}> | null;

export default class EngineManager {
  private binanceListner: BinanceClassListner;
  private redisClient: RedisClientType;
  private positionManager: PostionManager;
  private matchingManger: MatchingEngine;

  constructor() {
    this.redisClient = redisClient.duplicate();
    this.binanceListner = new BinanceClassListner(redisClient.duplicate());
    this.positionManager = new PostionManager();
    this.matchingManger = new MatchingEngine(this.positionManager);
  }

  async sendTobackend(response: EngineResponse.ENGINE_RESPONSE) {
    const publisher = await this.redisClient.connect();
    await publisher.xAdd("to-backend", "*", { data: JSON.stringify(response) });
  }

  hadleRequest(request: EngineRequest.ENGINE_REQUEST) {
    if (request.type === "get_balance") {
      const { correlationId } = request;
      const { market, userId } = request.paylaod;
      const balance = this.matchingManger.getBalance(userId, market);
      const numericBalance = typeof balance === "number" ? balance : null;
      this.sendTobackend({
        correlationId,
        type: "get_balance",
        payload: numericBalance,
      });
    } else if (request.type === "create_order") {
      const { correlationId } = request;
      const { userId, qty, market, margin, type, kind, price } =
        request.payload;
      const createOrder = this.matchingManger.createOrder(
        userId,
        market,
        type,
        kind,
        qty,
        price,
        margin,
      );
      if (!createOrder) {
        this.sendTobackend({
          correlationId,
          type: "error",
          payload: { error: "ERROR_IN_CREATING_ORDER" },
        });
        return;
      }
      this.sendTobackend({
        correlationId,
        type: "create_order",
        payload: createOrder,
      });
    } else if (request.type === "add_balance") {
      const { correlationId } = request;
      const { userId, amount } = request.payload;
      // TODO ask should i return a string acknowledge mesaage
      this.matchingManger.addBalance(userId, amount);
      this.sendTobackend({ correlationId, type: "add_balance", payload: null });
    } else if (request.type === "cancel_order") {
      const { correlationId } = request;
      const { userId, orderId } = request.payload;
      const cancelled = this.matchingManger.cancelOrder(userId, orderId);
      if (!cancelled) {
        this.sendTobackend({
          correlationId,
          type: "error",
          payload: { error: "NOT_ABLE_TO_CANCEL" },
        });
        return;
      }
      this.sendTobackend({
        correlationId,
        type: "cancel_order",
        payload: {
          orderId: cancelled.orderId!,
          userId: cancelled.userId!,
          kind: cancelled.kind,
          market: cancelled.market,
          price: cancelled.price,
          totalQty: cancelled.totalQty!,
          filledQty: cancelled.filledQty!,
          margin: cancelled.margin,
        },
      });
    } else if (request.type === "markprice_updated") {
      console.log("liquidation started");
      const { price, market } = request.payload;
      this.positionManager.updateMarkpriceMap(market, price);
      const userToLiquidate = this.positionManager.calculateLiquidation(
        market,
        price,
      );
      userToLiquidate?.forEach((user) => {
        const { qty, margin, userId, kind, market, costBasis } = user;
        const liquidationOrder =
          this.matchingManger.palceMarketOrderForLiquidation(
            userId,
            kind,
            qty,
            margin,
            market,
            costBasis,
          );
        if (!liquidationOrder) return;

        this.sendTobackend({
          type: "liquidation",
          payload: {
            orderId: liquidationOrder.orderId,
            userId,
            kind: liquidationOrder.kind as any,
            market,
            filledQty: liquidationOrder.filledQty,
            totalQty: liquidationOrder.totalQty,
            totalSpent: liquidationOrder.totalSpent,
            fills: liquidationOrder.fills,
          },
        });
      });
    } else if (request.type === "run_funding_rate") {
      setInterval(
        async () => {
          const publisher = await redisClient.connect();
          publisher.xAdd("to-engine", "*", {
            data: JSON.stringify({ type: "run_funding_rate" }),
          });
        },
        8 * 60 * 60 * 1000,
      ); // 8hr timer
      allMarketsList.forEach((market) => {
        const markPrice =
          this.positionManager.getMarkpriceOfMarket(market) || 0;
        const lastTradedPrice =
          this.matchingManger.getLastTradedPriceOFMarket(market) || 0;
        this.positionManager.claculateFundingRate(
          markPrice,
          lastTradedPrice,
          market,
        );
      });
    }
  }

  async addSnapShotInFile(data: any) {
    const path = await this.getSnapShotFolderPath();
    const date = Date.now();
    await fs.writeFile(`${path}/${date}.txt`, JSON.stringify(data));
  }

  async loadLatestSnapShotfromFile() {
    //
    const pathLocation = await this.getSnapShotFolderPath();

    let latestFile = "";

    // files is an array of strings representing names of files and folders
    const files = await fs.readdir(pathLocation);

    console.log(files);
    if (files.length === 0) {
      return null;
    }

    for (const file of files) {
      const stringDate = file.split(".")[0];
      if (Number(latestFile) < Number(stringDate)) {
        latestFile = stringDate!;
      }
    }

    const latestFilePathName = path.join(pathLocation, latestFile);
    console.log("[LATEST_FILEPATH]", latestFilePathName);

    const data = await fs.readFile(latestFilePathName, "utf8");
    const parsedSnapShot = JSON.parse(data ?? "") as EngineSnapShotInstanceType;
    this.matchingManger.loadSnapShotOfEngine(parsedSnapShot);
  }

  async getSnapShotFolderPath() {
    const currentFilePath = import.meta.dir;
    const rootFolder = path.join(currentFilePath, "..", "..");
    const destinationFolder = path.join(rootFolder, "snapshot");
    try {
      await fs.stat(destinationFolder);
    } catch (error) {
      await fs.mkdir(destinationFolder, { recursive: true });
      console.log("created a folder");
    }
    console.log("directroy created");

    return destinationFolder;
  }

  async start() {
    // load snapshot if avaialbel
    console.log("loading snapshot...");

    await this.loadLatestSnapShotfromFile();

    console.log("snapshot loaded");

    setInterval(async () => {
      await this.addSnapShotInFile(this.matchingManger.getSnapShotOfEngine());
    }, 8000 // 8 seconds
);

    console.log("waiting for binance...");
    // write now we are supposing error wont come
    await this.binanceListner.intialize();
    console.log("connected to binance");

    console.log("subscribing to stream...");

    const subscriber = await this.redisClient.connect();
    console.log("connected to stream");

    while (1) {
      const response = await subscriber.xRead([{ key: "to-engine", id: "$" }], {
        BLOCK: 0,
        COUNT: 100,
      });

      if (!response) {
        continue;
      }
      // loop to read msga and give to handler
      for (const stream of response) {
        for (const msg of stream.messages) {
          const parsedMessage = JSON.parse(msg.message.data!) || {};
          const { success, data } =
            EngineRequest.ENGINE_REQUEST_SCHEMA.safeParse(parsedMessage);
          if (!success) continue;
          console.log("message come and handling to engine");
          this.hadleRequest(data);
        }
      }
    }
  }
}
