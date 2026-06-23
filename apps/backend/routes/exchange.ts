import { Router } from "express";
import crypto from "crypto";
import { sendToEngine } from "../utils/toEngine";
import { isAuth } from "../middleware/authentication";
import { BackendRequest, EngineRequest, Shared } from "@repo/shared-types";

const exchangeRoutes = Router();

exchangeRoutes.post("/onramp", isAuth, async (req, res) => {
    const { success, data } = BackendRequest.ADD_BALANCE_SCHEMA.safeParse(req.body);
    if (!success) {
        return res.status(411).json({
            msg: "invalid input fields"
        });
    }

    const { amount } = data.data;

    const engineRequest: EngineRequest.ADD_BALANCE = {
        correlationId: crypto.randomUUID(),
        type: "add_balance",
        payload: {
            userId: req.userId!,
            amount
        }
    };

    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        });
    }

    if (engineResponse.type === "error") {
        return res.status(400).json({
            msg: engineResponse.payload.error
        });
    }

    res.status(201).json({
        ok: true,
        data: engineResponse.payload
    });
});

exchangeRoutes.post("/order", isAuth, async (req, res) => {
    const { success, data } = BackendRequest.CREATE_ORDER_SCHEMA.safeParse(req.body);
    if (!success) {
        return res.status(411).json({
            msg: "invalid input fields"
        });
    }

    const { qty, price, market, type, kind, margin } = data.data;

    const engineRequest: EngineRequest.CREATE_ORDER = {
        correlationId: crypto.randomUUID(),
        type: "create_order",
        payload: {
            userId: req.userId!,
            kind,
            qty: Number(qty),
            price,
            market,
            type,
            margin
        }
    };
    const engineResponse = await sendToEngine(engineRequest);

    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        });
    }

    if (engineResponse.type === "error") {
        return res.status(400).json({
            msg: engineResponse.payload.error
        });
    }

    return res.status(200).json({
        ok: true,
        data: engineResponse.payload
    });
});

exchangeRoutes.get("/equity/available", isAuth, async (req, res) => {
    const marketRaw = req.query.market as string | undefined;
    let market: Shared.MARKET_AVAILABEL | undefined;
    if (marketRaw !== undefined) {
        const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketRaw);
        if (!parsed.success) {
            return res.status(400).json({
                msg: "invalid market"
            });
        }
        market = parsed.data;
    }

    const engineRequest: EngineRequest.GET_BALANCE = {
        correlationId: crypto.randomUUID(),
        type: "get_balance",
        paylaod: {
            userId: req.userId!,
            market
        }
    };

    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        });
    }

    if (engineResponse.type === "error") {
        return res.status(400).json({
            msg: engineResponse.payload.error
        });
    }

    res.status(200).json({
        ok: true,
        data: engineResponse.payload
    });
});

exchangeRoutes.get("/positions/open/:marketId", isAuth, async (req, res) => {
    const marketId = req.params.marketId === "all" ? undefined : req.params.marketId;
    let market: Shared.MARKET_AVAILABEL | undefined;
    if (marketId !== undefined) {
        const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
        if (!parsed.success) {
            return res.status(400).json({
                msg: "invalid market"
            });
        }
        market = parsed.data;
    }

    const engineRequest: EngineRequest.GET_POSITION = {
        correlationId: crypto.randomUUID(),
        type: "get_position",
        payload: {
            userId: req.userId!,
            market
        }
    };

    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        });
    }

    if (engineResponse.type === "error") {
        return res.status(400).json({
            msg: engineResponse.payload.error
        });
    }

    res.status(200).json({
        ok: true,
        data: engineResponse.payload
    });
});

exchangeRoutes.get("/positions/closed/:marketId", isAuth, async (req, res) => {
    const marketId = req.params.marketId === "all" ? undefined : req.params.marketId;
    let market: Shared.MARKET_AVAILABEL | undefined;
    if (marketId !== undefined) {
        const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
        if (!parsed.success) {
            return res.status(400).json({
                msg: "invalid market"
            });
        }
        market = parsed.data;
    }

    const engineRequest: EngineRequest.GET_CLOSED_ORDERS = {
        correlationId: crypto.randomUUID(),
        type: "get_closed_orders",
        payload: {
            userId: req.userId!,
            market
        }
    };

    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        });
    }

    if (engineResponse.type === "error") {
        return res.status(400).json({
            msg: engineResponse.payload.error
        });
    }

    res.status(200).json({
        ok: true,
        data: engineResponse.payload
    });
});

exchangeRoutes.get("/orders/open/:marketId", isAuth, async (req, res) => {
    const marketId = req.params.marketId === "all" ? undefined : req.params.marketId;
    let market: Shared.MARKET_AVAILABEL | undefined;
    if (marketId !== undefined) {
        const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
        if (!parsed.success) {
            return res.status(400).json({
                msg: "invalid market"
            });
        }
        market = parsed.data;
    }

    const engineRequest: EngineRequest.GET_OPEN_ORDERS = {
        correlationId: crypto.randomUUID(),
        type: "get_open_orders",
        payload: {
            userId: req.userId!,
            market
        }
    };

    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        });
    }

    if (engineResponse.type === "error") {
        return res.status(400).json({
            msg: engineResponse.payload.error
        });
    }

    res.status(200).json({
        ok: true,
        data: engineResponse.payload
    });
});

exchangeRoutes.get("/orders/:marketId", isAuth, async (req, res) => {
    const marketId = req.params.marketId === "all" ? undefined : req.params.marketId;
    let market: Shared.MARKET_AVAILABEL | undefined;
    if (marketId !== undefined) {
        const parsed = Shared.MARKET_AVAILABEL_SCHEMA.safeParse(marketId);
        if (!parsed.success) {
            return res.status(400).json({
                msg: "invalid market"
            });
        }
        market = parsed.data;
    }

    const openRequest: EngineRequest.GET_OPEN_ORDERS = {
        correlationId: crypto.randomUUID(),
        type: "get_open_orders",
        payload: {
            userId: req.userId!,
            market
        }
    };
 
    const closedRequest: EngineRequest.GET_CLOSED_ORDERS = {
        correlationId: crypto.randomUUID(),
        type: "get_closed_orders",
        payload: {
            userId: req.userId!,
            market
        }
    };

    const [openRes, closedRes] = await Promise.all([
        sendToEngine(openRequest),
        sendToEngine(closedRequest)
    ]);

    if (!openRes || !closedRes) {
        return res.status(403).json({
            msg: "some error occured"
        });
    }

    if (openRes.type === "error") {
        return res.status(400).json({ msg: openRes.payload.error });
    }
    if (closedRes.type === "error") {
        return res.status(400).json({ msg: closedRes.payload.error });
    }

    const openOrders = openRes.type === "get_open_orders" ? openRes.payload : [];
    const closedOrders = closedRes.type === "get_closed_orders" ? closedRes.payload : [];

    res.status(200).json({
        ok: true,
        data: [...openOrders, ...closedOrders]
    });
});

exchangeRoutes.get("/fills", isAuth, async (req, res) => {
    const engineRequest: EngineRequest.GET_FILLS = {
        correlationId: crypto.randomUUID(),
        type: "get_fills",
        payload: {
            userId: req.userId!
        }
    };

    const engineResponse = await sendToEngine(engineRequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        });
    }

    if (engineResponse.type === "error") {
        return res.status(400).json({
            msg: engineResponse.payload.error
        });
    }

    res.status(200).json({
        ok: true,
        data: engineResponse.payload
    });
});

export default exchangeRoutes;
