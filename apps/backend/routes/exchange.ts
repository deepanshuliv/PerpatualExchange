import { Router } from "express";
import { toEngine } from "../utils/toEngine";
import { isAuth } from "../middleware/authentication";
import { BackendRequest, EngineRequest } from "shared-types";

const exchangeRoutes = Router()

exchangeRoutes.post("/onramp", async (req, res) => {
    // TO DO add zod  validation 
    const { success, data } = BackendRequest.ADD_BALANCE_SCHEMA.safeParse(req.body);
    if (!success) {
        return res.status(411).json({
            msg: "invalid input fields"
        })
    }

    const engineResponse = await toEngine(data);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        engineResponse
    })

})

exchangeRoutes.post("/order", isAuth, async (req, res) => {
    const { success, data } = BackendRequest.CREATE_ORDER_SCHEMA.safeParse(req.body);
    if (!success) {
        return res.status(411).json({
            msg: "invalid input fields"
        })
    }

    const { qty, price, market, type, kind, margin } = data.data;

    const engineRequest: EngineRequest.CREATE_ORDER = {
        correlationId: crypto.randomUUID(),
        stream: process.env.REQUEST_STREAM!,
        payload: {
            userId: req.userId!,
            kind,
            qty,
            price,
            market,
            type,
            margin
        }
    }
    const engineResponse = await toEngine(engineRequest);

    if (!engineResponse && engineResponse) {
        return res.status(411).json({

        })
    }

})

exchangeRoutes.get("/equity/available", isAuth, async (req, res) => {
    const { success, data } = BackendRequest.GET_POSITION_SCHEMA.safeParse(req.body);
    if (!success) {
        return res.status(411).json({
            msg: "invalid inputs"
        })
    }
    const { market } = data.data;

    const engineReequest: BackendRequest.GET_POSITION = {
        correlationId: crypto.randomUUID(),
        type: "get_position",
        data: {
            market
        },
        reponseStream: process.env.REPONSE_STREAM!,
    }

    const engineResponse = await toEngine(engineReequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        data: engineResponse
    })

})

exchangeRoutes.get("/positions/open/:marketId", isAuth, async (req, res) => {
    const engineReequest: EngineRequest = {
        correlationId: crypto.randomUUID(),
        messageType: "open_position",
        payload: {
            userId: req.userId,
            status: "OPEN"
        },
        reponseStream: process.env.REPONSE_STREAM!,
    }

    const engineResponse = await toEngine(engineReequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        data: engineResponse
    })
});
exchangeRoutes.get("/positions/closed/:marketId", isAuth, async (req, res) => {
    // TO DO :- write zod validation to marketId param 
    // get market name or symbol from Db 
    const engineReequest: EngineRequest = {
        correlationId: crypto.randomUUID(),
        messageType: "closed_position",
        payload: {
            userId: req.userId,
            status: "CANCELLED",
            marketId: req.params.marketId
        },
        reponseStream: process.env.REPONSE_STREAM!,
    }

    const engineResponse = await toEngine(engineReequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        data: engineResponse
    })
});
exchangeRoutes.get("/orders/open/:marketId", isAuth, async (req, res) => {
    const engineReequest: EngineRequest = {
        correlationId: crypto.randomUUID(),
        messageType: "open_orders",
        payload: {
            userId: req.userId,
            marketid: req.params
        },
        reponseStream: process.env.REPONSE_STREAM!,
    }

    const engineResponse = await toEngine(engineReequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        data: engineResponse
    })
})
exchangeRoutes.get("/orders/:marketId", isAuth, (req, res) => {
    //get from 
})
exchangeRoutes.get("/fills", isAuth, (req, res) => {
    // get from Db for particular user    
});


export default exchangeRoutes;
